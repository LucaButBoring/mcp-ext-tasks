/** Non-owning manual access to an existing task. */

import { ProtocolDecodeError } from "../core/index.js";
import type { RuntimeCodec, TaskId } from "../core/index.js";
import type { CallToolResultV1 } from "../core/v1/index.js";
import { InputResponsesV2Schema } from "../core/v2/index.js";
import type { CallToolResultV2, DetailedTaskV2 } from "../core/v2/index.js";
import {
  TaskCancellationUnsupportedError,
  TaskCancelledError,
  TaskInputUpdateUnsupportedError,
} from "./api.js";
import type {
  TaskController,
  TaskControllerOptions,
  TaskResultOptions,
} from "./api.js";
import {
  DEFAULT_TASK_POLL_INTERVAL_MS,
  defaultResultCodec,
  taskPollInterval,
  terminalStatus,
  waitForTaskPoll,
} from "./execution.js";
import {
  completedOutcome,
  projectTask,
  semanticCapabilities,
} from "./internal.js";
import { throwIfAborted } from "./input-routing.js";
import { createTaskRpc, linkAbortSignals } from "./port.js";
import type {
  ConnectedMcpSessionPort,
  DispatchContext,
  TaskRpcV1,
  TaskRpcV2,
} from "./port.js";
import { resolveTerminalTaskResult } from "./task-protocol-v2.js";

function selectResultCodec<TResult>(
  generation: "v1" | "v2",
  codec: RuntimeCodec<TResult> | undefined,
): RuntimeCodec<TResult> {
  if (codec !== undefined) return codec;
  const fallback = defaultResultCodec(generation);
  return {
    parse(value) {
      const decoded = fallback.parse(value);
      if (!decoded.success) return decoded;
      return { success: true, value: decoded.value as TResult };
    },
  };
}

/** Creates a generation-aware, non-owning controller for explicit task operations. */
export function createTaskController(
  port: ConnectedMcpSessionPort,
  taskId: TaskId,
  options: TaskControllerOptions,
  lifecycleSignal: AbortSignal,
  assertUsable: () => void,
): TaskController {
  const capabilities = port.taskCapabilities;
  if (capabilities.generation === "none")
    throw new Error("Task management is not supported by this session");
  const generation = capabilities.generation;
  const context: DispatchContext | undefined =
    options.headers === undefined && options.requestTimeoutMs === undefined
      ? undefined
      : {
          headers: options.headers,
          requestTimeoutMs: options.requestTimeoutMs,
        };
  const rpc: TaskRpcV1 | TaskRpcV2 =
    generation === "v1"
      ? createTaskRpc(generation, { port, taskId, context })
      : createTaskRpc(generation, { port, taskId, context });

  const runOperation = async <T>(
    signal: AbortSignal | undefined,
    operation: (operationSignal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    const linked = linkAbortSignals(lifecycleSignal, signal);
    try {
      assertUsable();
      throwIfAborted(linked.signal);
      const result = await operation(linked.signal);
      assertUsable();
      throwIfAborted(linked.signal);
      return result;
    } finally {
      linked.dispose();
    }
  };

  return {
    taskId,
    capabilities: semanticCapabilities(capabilities),
    async snapshot(signal) {
      return runOperation(signal, async (operationSignal) =>
        projectTask(
          rpc.generation === "v1"
            ? { generation: "v1", task: await rpc.get(operationSignal) }
            : { generation: "v2", task: await rpc.get(operationSignal) },
        ),
      );
    },
    async result<TResult = CallToolResultV1 | CallToolResultV2>(
      resultOptions: TaskResultOptions<TResult> = {},
    ) {
      const codec = selectResultCodec(generation, resultOptions.resultCodec);
      return runOperation(resultOptions.signal, async (operationSignal) => {
        if (rpc.generation === "v1") {
          // Poll to a terminal state before touching tasks/result, because a
          // V1 server errors on any non-completed task — calling it directly
          // would turn a cancelled task into a failed outcome.
          let task = await rpc.get(operationSignal);
          while (!terminalStatus(task.status)) {
            await waitForTaskPoll(
              Math.max(
                DEFAULT_TASK_POLL_INTERVAL_MS,
                task.pollInterval ?? DEFAULT_TASK_POLL_INTERVAL_MS,
              ),
              operationSignal,
            );
            task = await rpc.get(operationSignal);
          }
          const view = projectTask({ generation: "v1", task });
          const terminalTask = task;
          return completedOutcome(
            Promise.resolve().then(() => {
              if (terminalTask.status === "cancelled")
                throw new TaskCancelledError();
              if (terminalTask.status === "failed")
                throw new Error(terminalTask.statusMessage ?? "Task failed");
              return rpc.result(codec, operationSignal);
            }),
            view,
          );
        }

        let task: DetailedTaskV2 = await rpc.get(operationSignal);
        while (!terminalStatus(task.status)) {
          await waitForTaskPoll(
            taskPollInterval(task.pollIntervalMs),
            operationSignal,
          );
          task = await rpc.get(operationSignal);
        }
        const view = projectTask({ generation: "v2", task });
        return completedOutcome(
          Promise.resolve().then(() =>
            resolveTerminalTaskResult({
              task,
              resultCodec: codec,
              cancelledError: new TaskCancelledError(),
            }),
          ),
          view,
        );
      });
    },
    async cancel(signal) {
      await runOperation(signal, async (operationSignal) => {
        if (
          generation === "v1" &&
          capabilities.capabilities.cancel === undefined
        )
          throw new TaskCancellationUnsupportedError();
        await rpc.cancel(operationSignal);
      });
    },
    async update(inputResponses, signal) {
      await runOperation(signal, async (operationSignal) => {
        if (rpc.generation === "v1")
          throw new TaskInputUpdateUnsupportedError();
        await rpc.update(inputResponses, operationSignal);
      });
    },
    async updateJson(inputResponses, signal) {
      await runOperation(signal, async (operationSignal) => {
        if (rpc.generation === "v1")
          throw new TaskInputUpdateUnsupportedError();
        const decoded = InputResponsesV2Schema.safeParse(inputResponses);
        if (!decoded.success) {
          throw new ProtocolDecodeError(
            "Task input responses failed schema validation",
            {},
            { cause: decoded.error },
          );
        }
        await rpc.update(decoded.data, operationSignal);
      });
    },
  };
}
