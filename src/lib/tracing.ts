import { AsyncLocalStorage } from "async_hooks";

import { v4 as uuidv4 } from "uuid";

interface TraceContext {
  traceId: string;
  requestId: string;
}

export const traceStorage = new AsyncLocalStorage<TraceContext>();

export function generateTraceId(): string {
  return `trace_${uuidv4().slice(0, 8)}`;
}

export function generateRequestId(): string {
  return `req_${uuidv4().slice(0, 8)}`;
}

export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

export function createTraceContext(): TraceContext {
  return {
    traceId: generateTraceId(),
    requestId: generateRequestId(),
  };
}
