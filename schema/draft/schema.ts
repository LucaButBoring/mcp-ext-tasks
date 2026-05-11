/**
 * MCP Tasks Extension Schema (spec.types.ts)
 * Extension Identifier: io.modelcontextprotocol/tasks
 *
 * This file contains pure TypeScript interface definitions for the MCP Tasks extension.
 * These types are the source of truth and are used to generate Zod schemas via `ts-to-zod`.
 *
 * - Use `@description` JSDoc tags to generate `.describe()` calls on schemas
 * - Run `npm run generate:schemas` to regenerate schemas from these types
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
 */

import type {
  Cursor,
  JSONRPCNotification,
  JSONRPCRequest,
  NotificationParams,
  PaginatedRequest,
  PaginatedResult,
  ProgressToken,
  RequestId,
  RequestParams,
  Result,
} from "@modelcontextprotocol/sdk/types.js";

/* Tasks */

/**
 * The status of a task.
 *
 * @category `tasks`
 */
export type TaskStatus =
  | "working" // The request is currently being processed
  | "input_required" // The task is waiting for input (e.g., elicitation or sampling)
  | "completed" // The request completed successfully and results are available
  | "failed" // The associated request did not complete successfully. For tool calls specifically, this includes cases where the tool call result has `isError` set to true.
  | "cancelled"; // The request was cancelled before completion

/**
 * Metadata for augmenting a request with task execution.
 * Include this in the `task` field of the request parameters.
 *
 * @category `tasks`
 */
export interface TaskMetadata {
  /**
   * Requested duration in milliseconds to retain task from creation.
   */
  ttl?: number;
}

/**
 * Metadata for associating messages with a task.
 * Include this in the `_meta` field under the key `io.modelcontextprotocol/related-task`.
 *
 * @category `tasks`
 */
export interface RelatedTaskMetadata {
  /**
   * The task identifier this message is associated with.
   */
  taskId: string;
}

/**
 * Data associated with a task.
 *
 * @category `tasks`
 */
export interface Task {
  /**
   * The task identifier.
   */
  taskId: string;

  /**
   * Current task state.
   */
  status: TaskStatus;

  /**
   * Optional human-readable message describing the current task state.
   * This can provide context for any status, including:
   * - Reasons for "cancelled" status
   * - Summaries for "completed" status
   * - Diagnostic information for "failed" status (e.g., error details, what went wrong)
   */
  statusMessage?: string;

  /**
   * ISO 8601 timestamp when the task was created.
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the task was last updated.
   */
  lastUpdatedAt: string;

  /**
   * Actual retention duration from creation in milliseconds, null for unlimited.
   * @nullable
   */
  ttl: number | null;

  /**
   * Suggested polling interval in milliseconds.
   */
  pollInterval?: number;
}

/**
 * A response to a task-augmented request.
 *
 * @category `tasks`
 */
export interface CreateTaskResult extends Result {
  task: Task;
}

/* Task Operations */

/**
 * A request to retrieve the state of a task.
 *
 * @category `tasks/get`
 */
export interface GetTaskRequest extends JSONRPCRequest {
  method: "tasks/get";
  params: {
    /**
     * The task identifier to query.
     */
    taskId: string;
  };
}

/**
 * The response to a tasks/get request.
 *
 * @category `tasks/get`
 */
export type GetTaskResult = Result & Task;

/**
 * A request to retrieve the result of a completed task.
 *
 * @category `tasks/result`
 */
export interface GetTaskPayloadRequest extends JSONRPCRequest {
  method: "tasks/result";
  params: {
    /**
     * The task identifier to retrieve results for.
     */
    taskId: string;
  };
}

/**
 * The response to a tasks/result request.
 * The structure matches the result type of the original request.
 * For example, a tools/call task would return the CallToolResult structure.
 *
 * @category `tasks/result`
 */
export interface GetTaskPayloadResult extends Result {
  [key: string]: unknown;
}

/**
 * A request to cancel a task.
 *
 * @category `tasks/cancel`
 */
export interface CancelTaskRequest extends JSONRPCRequest {
  method: "tasks/cancel";
  params: {
    /**
     * The task identifier to cancel.
     */
    taskId: string;
  };
}

/**
 * The response to a tasks/cancel request.
 *
 * @category `tasks/cancel`
 */
export type CancelTaskResult = Result & Task;

/**
 * A request to retrieve a list of tasks.
 *
 * @category `tasks/list`
 */
export interface ListTasksRequest extends PaginatedRequest {
  method: "tasks/list";
}

/**
 * The response to a tasks/list request.
 *
 * @category `tasks/list`
 */
export interface ListTasksResult extends PaginatedResult {
  tasks: Task[];
}

/* Task Notifications */

/**
 * Parameters for a `notifications/tasks/status` notification.
 *
 * @category `notifications/tasks/status`
 */
export type TaskStatusNotificationParams = NotificationParams &
  Task & { [key: string]: unknown };

/**
 * An optional notification from the receiver to the requestor, informing them that a task's status has changed. Receivers are not required to send these notifications.
 *
 * @category `notifications/tasks/status`
 */
export interface TaskStatusNotification extends JSONRPCNotification {
  method: "notifications/tasks/status";
  params: TaskStatusNotificationParams;
}

/* Task-Augmented Request Params */

/**
 * Common params for any task-augmented request.
 * Extends the base RequestParams to include an optional `task` field.
 *
 * @category `tasks`
 */
export interface TaskAugmentedRequestParams extends RequestParams {
  /**
   * If specified, the caller is requesting task-augmented execution for this request.
   * The request will return a CreateTaskResult immediately, and the actual result can be
   * retrieved later via tasks/result.
   *
   * Task augmentation is subject to capability negotiation - receivers MUST declare support
   * for task augmentation of specific request types in their capabilities.
   */
  task?: TaskMetadata;
}

/* Capability Additions */

/**
 * Task-related server capabilities.
 * Include this in the server's `capabilities` object during initialization.
 *
 * @category `tasks`
 */
export interface TaskServerCapabilities {
  tasks?: {
    /**
     * Whether this server supports tasks/list.
     */
    list?: Record<string, never>;
    /**
     * Whether this server supports tasks/cancel.
     */
    cancel?: Record<string, never>;
    /**
     * Specifies which request types can be augmented with tasks.
     */
    requests?: {
      /**
       * Task support for tool-related requests.
       */
      tools?: {
        /**
         * Whether the server supports task-augmented tools/call requests.
         */
        call?: Record<string, never>;
      };
    };
  };
}

/**
 * Task-related client capabilities.
 * Include this in the client's `capabilities` object during initialization.
 *
 * @category `tasks`
 */
export interface TaskClientCapabilities {
  tasks?: {
    /**
     * Whether this client supports tasks/list.
     */
    list?: Record<string, never>;
    /**
     * Whether this client supports tasks/cancel.
     */
    cancel?: Record<string, never>;
    /**
     * Specifies which request types can be augmented with tasks.
     */
    requests?: {
      /**
       * Task support for sampling-related requests.
       */
      sampling?: {
        /**
         * Whether the client supports task-augmented sampling/createMessage requests.
         */
        createMessage?: Record<string, never>;
      };
      /**
       * Task support for elicitation-related requests.
       */
      elicitation?: {
        /**
         * Whether the client supports task-augmented elicitation/create requests.
         */
        create?: Record<string, never>;
      };
    };
  };
}

/* Tool-Level Task Support */

/**
 * Task support declaration for individual tools.
 * Include this in the tool's definition returned by tools/list.
 *
 * - "forbidden": Tool does not support task-augmented execution (default when absent)
 * - "optional": Tool may support task-augmented execution
 * - "required": Tool requires task-augmented execution
 *
 * @category `tasks`
 */
export type ToolTaskSupport = "forbidden" | "optional" | "required";
