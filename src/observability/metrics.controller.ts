import { Controller, Get, Header } from "@nestjs/common";
import { register } from "./metrics";

/** Exposes the prom-client registry in Prometheus text format. */
@Controller()
export class MetricsController {
  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  metrics(): Promise<string> {
    return register.metrics();
  }
}
