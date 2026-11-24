import { HttpException, HttpStatus } from "@nestjs/common";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of, throwError, firstValueFrom } from "rxjs";
import { MetricsInterceptor } from "./metrics.interceptor";
import { register } from "./metrics";

function context(statusCode = 200, routePath = "/api/v1/products/:productId") {
  const req = {
    method: "GET",
    path: "/api/v1/products/SKU-1001",
    route: { path: routePath },
  };
  const res = { statusCode };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe("MetricsInterceptor", () => {
  it("records successful requests", async () => {
    const interceptor = new MetricsInterceptor();
    const handler: CallHandler = { handle: () => of("ok") };

    await firstValueFrom(interceptor.intercept(context(200), handler));

    const metrics = await register.metrics();
    expect(metrics).toContain("http_requests_total");
    expect(metrics).toContain('route="/api/v1/products/:productId"');
  });

  it("records http exceptions with their status", async () => {
    const interceptor = new MetricsInterceptor();
    const handler: CallHandler = {
      handle: () =>
        throwError(() => new HttpException("gone", HttpStatus.GONE)),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context(), handler)),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
