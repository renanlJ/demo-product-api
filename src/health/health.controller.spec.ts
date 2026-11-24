import type { Response } from "express";
import { loadConfig } from "../config/configuration";
import { DownstreamService } from "../downstream/downstream.service";
import { HealthController } from "./health.controller";

function fakeResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe("HealthController", () => {
  it("healthz always returns ok", () => {
    const controller = new HealthController(
      {} as DownstreamService,
      loadConfig({}),
    );
    expect(controller.health()).toEqual({ status: "ok" });
  });

  it("readyz returns 200 when all downstreams reachable", async () => {
    const downstream = {
      ping: jest.fn().mockResolvedValue([
        { name: "details", reachable: true },
        { name: "reviews", reachable: true },
        { name: "ratings", reachable: true },
      ]),
    } as unknown as DownstreamService;
    const res = fakeResponse();

    await new HealthController(downstream, loadConfig({})).ready(res);

    expect(res.json).toHaveBeenCalledWith({ status: "ready" });
  });

  it("readyz returns 503 listing unreachable services", async () => {
    const downstream = {
      ping: jest.fn().mockResolvedValue([
        { name: "details", reachable: true },
        { name: "reviews", reachable: false },
        { name: "ratings", reachable: true },
      ]),
    } as unknown as DownstreamService;
    const res = fakeResponse();

    await new HealthController(downstream, loadConfig({})).ready(res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      status: "not ready",
      unreachable: ["reviews"],
    });
  });

  it("readyz returns 503 when FAIL_READINESS is set", async () => {
    const res = fakeResponse();
    const controller = new HealthController(
      {} as DownstreamService,
      loadConfig({ FAIL_READINESS: "true" }),
    );

    await controller.ready(res);

    expect(res.status).toHaveBeenCalledWith(503);
  });
});
