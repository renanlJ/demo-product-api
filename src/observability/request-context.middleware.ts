import { randomBytes, randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { runWithContext } from "./als";

/**
 * Generates or propagates the X-Request-ID header and stores the request
 * context (request ID + inbound traceparent) in AsyncLocalStorage so every
 * downstream call and log line can correlate.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers["x-request-id"];
    const requestId =
      (Array.isArray(inbound) ? inbound[0] : inbound)?.trim() ||
      randomUUID().replace(/-/g, "");

    const traceparentHeader = req.headers["traceparent"];
    let traceparent = Array.isArray(traceparentHeader)
      ? traceparentHeader[0]
      : traceparentHeader;
    if (!traceparent) {
      // Start a root trace so all downstream calls in this request share
      // one W3C trace ID even when the caller sent no traceparent.
      traceparent = `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
    }

    res.setHeader("X-Request-ID", requestId);
    runWithContext({ requestId, traceparent }, () => next());
  }
}
