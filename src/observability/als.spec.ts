import { outboundTraceparent, runWithContext, getRequestContext } from "./als";

describe("request context", () => {
  it("exposes the store inside runWithContext", () => {
    const result = runWithContext(
      { requestId: "r1" },
      () => getRequestContext()?.requestId,
    );
    expect(result).toBe("r1");
  });

  it("returns undefined outside a context", () => {
    expect(getRequestContext()).toBeUndefined();
  });
});

describe("outboundTraceparent", () => {
  it("starts a new trace without inbound context", () => {
    const tp = outboundTraceparent();
    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("continues the inbound trace id with a fresh span id", () => {
    const inbound = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const tp = outboundTraceparent({
      requestId: "r",
      traceparent: inbound,
    });
    expect(tp).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
    expect(tp).not.toContain("00f067aa0ba902b7");
  });
});
