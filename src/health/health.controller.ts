import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { APP_CONFIG, AppConfig } from "../config/configuration";
import { DownstreamService } from "../downstream/downstream.service";

/** Liveness and readiness probes. Readiness also checks downstream reachability. */
@Controller()
export class HealthController {
  constructor(
    private readonly downstream: DownstreamService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get("healthz")
  health(): { status: string } {
    return { status: "ok" };
  }

  @Get("readyz")
  async ready(@Res() res: Response): Promise<void> {
    if (this.config.failReadiness) {
      res.status(503).json({ status: "not ready", reason: "FAIL_READINESS" });
      return;
    }
    const checks = await this.downstream.ping();
    const unreachable = checks.filter((c) => !c.reachable).map((c) => c.name);
    if (unreachable.length > 0) {
      res.status(503).json({ status: "not ready", unreachable });
      return;
    }
    res.json({ status: "ready" });
  }
}
