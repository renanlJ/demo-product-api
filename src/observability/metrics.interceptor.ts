import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import {
  httpRequestDuration,
  httpRequestsErrorsTotal,
  httpRequestsTotal,
} from "./metrics";

/** Records request count, error count and duration for every HTTP request. */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.observe(req, res.statusCode, start),
        error: (err: unknown) =>
          this.observe(
            req,
            err instanceof HttpException ? err.getStatus() : 500,
            start,
          ),
      }),
    );
  }

  private observe(req: Request, status: number, start: bigint): void {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = this.routePattern(req);
    const labels = { method: req.method, route, status: String(status) };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
    if (status >= 500) {
      httpRequestsErrorsTotal.inc(labels);
    }
  }

  private routePattern(req: Request): string {
    const route = (req as Request & { route?: { path?: unknown } }).route;
    if (typeof route?.path === "string") {
      return route.path;
    }
    return req.path;
  }
}
