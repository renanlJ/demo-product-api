import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

export interface RequestContext {
  requestId: string;
  traceparent?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

/**
 * Derive a child traceparent for an outbound call: keeps the inbound trace ID
 * when present, otherwise starts a new trace. Span ID is always fresh.
 */
export function outboundTraceparent(ctx?: RequestContext): string {
  const spanId = randomBytes(8).toString("hex");
  const inbound = ctx?.traceparent?.toLowerCase();
  const match = inbound?.match(
    /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/,
  );
  const traceId = match ? match[1] : randomBytes(16).toString("hex");
  return `00-${traceId}-${spanId}-01`;
}
