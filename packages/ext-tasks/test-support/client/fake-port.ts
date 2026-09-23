import type { JsonValue } from "../../src/core/index.js";
import { z } from "zod/v4";
import type {
  ConnectedMcpSessionPort,
  DispatchOptions,
  IncomingServerRequest,
  JsonRpcResponse,
  SessionTaskCapabilities,
} from "../../src/client/index.js";
import { defaultServerRequestResponse } from "../../src/client/input-routing.js";

export const asJson = (value: unknown): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;

const JsonRecordSchema = z.record(z.string(), z.unknown());

export const expectRecord = (value: unknown): Record<string, unknown> =>
  JsonRecordSchema.parse(value);

export const formatJson = (value: unknown): string => {
  const encoded: unknown = JSON.stringify(value);
  return typeof encoded === "string" ? encoded : "undefined";
};

export const asError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(formatJson(reason));

export class FakePort implements ConnectedMcpSessionPort {
  readonly endpointId: string;
  readonly requests: JsonValue[] = [];
  readonly dispatchOptions: (DispatchOptions | undefined)[] = [];
  readonly taskCapabilities: SessionTaskCapabilities;
  invalidated = false;
  response: JsonRpcResponse = { kind: "result", result: { content: [] } };
  dispatchHandler?: (
    request: JsonValue,
    options?: DispatchOptions,
  ) => Promise<JsonRpcResponse>;
  private requestHandler?: (
    incoming: IncomingServerRequest,
  ) => Promise<JsonRpcResponse | undefined>;
  private notificationListener?: (notification: JsonValue) => void;
  private invalidationListener?: (reason: unknown) => void;
  listenerDisposals = 0;

  constructor(
    taskCapabilities: SessionTaskCapabilities = { generation: "none" },
    endpointId = "fake-endpoint",
  ) {
    this.taskCapabilities = taskCapabilities;
    this.endpointId = endpointId;
  }

  async dispatch(
    request: JsonValue,
    options?: DispatchOptions,
  ): Promise<JsonRpcResponse> {
    this.requests.push(request);
    this.dispatchOptions.push(options);
    return this.dispatchHandler === undefined
      ? this.response
      : this.dispatchHandler(request, options);
  }

  onServerRequest(
    handler: (
      incoming: IncomingServerRequest,
    ) => Promise<JsonRpcResponse | undefined>,
  ): () => void {
    this.requestHandler = handler;
    return () => {
      this.requestHandler = undefined;
      this.listenerDisposals += 1;
    };
  }

  onNotification(listener: (notification: JsonValue) => void): () => void {
    this.notificationListener = listener;
    return () => {
      this.notificationListener = undefined;
      this.listenerDisposals += 1;
    };
  }

  onInvalidated(listener: (reason: unknown) => void): () => void {
    this.invalidationListener = listener;
    return () => {
      this.invalidationListener = undefined;
      this.listenerDisposals += 1;
    };
  }

  invalidate(reason: unknown): void {
    this.invalidated = true;
    this.invalidationListener?.(reason);
  }

  async serve(request: JsonValue): Promise<JsonRpcResponse> {
    if (this.requestHandler === undefined)
      throw new Error("request handler is not installed");
    // The fake port plays a host with no prior fallback handler, so an
    // unhandled request settles with the same conservative default the SDK
    // adapter applies (cancel elicitations, error everything else).
    const response = await this.requestHandler({ request, requestContext: {} });
    return (
      response ?? defaultServerRequestResponse({ request, requestContext: {} })
    );
  }

  notify(notification: JsonValue): void {
    this.notificationListener?.(notification);
  }
}
