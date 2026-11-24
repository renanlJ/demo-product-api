import type { NextFunction, Request, Response } from "express";
import { getRequestContext } from "./als";
import { RequestContextMiddleware } from "./request-context.middleware";

function fakeReqRes(headers: Record<string, string>) {
  const req = { headers } as unknown as Request;
  const res = { setHeader: jest.fn() } as unknown as Response;
  return { req, res };
}

describe("RequestContextMiddleware", () => {
  it("generates a request ID when absent", () => {
    const { req, res } = fakeReqRes({});
    const mw = new RequestContextMiddleware();

    const next: NextFunction = () => {
      expect(getRequestContext()?.requestId).toMatch(/^[0-9a-f]{32}$/);
    };
    mw.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Request-ID",
      expect.stringMatching(/^[0-9a-f]{32}$/),
    );
  });

  it("propagates inbound request ID and traceparent", () => {
    const { req, res } = fakeReqRes({
      "x-request-id": "inbound-1",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    });
    const mw = new RequestContextMiddleware();

    const next: NextFunction = () => {
      const ctx = getRequestContext();
      expect(ctx?.requestId).toBe("inbound-1");
      expect(ctx?.traceparent).toContain("4bf92f3577b34da6a3ce929d0e0e4736");
    };
    mw.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "inbound-1");
  });
});
