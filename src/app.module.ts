import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { stdTimeFunctions } from "pino";
import { APP_CONFIG, loadConfig } from "./config/configuration";
import { DownstreamService } from "./downstream/downstream.service";
import { HealthController } from "./health/health.controller";
import { getRequestContext } from "./observability/als";
import { MetricsController } from "./observability/metrics.controller";
import { MetricsInterceptor } from "./observability/metrics.interceptor";
import { RequestContextMiddleware } from "./observability/request-context.middleware";
import { ProductsController } from "./products/products.controller";
import { ProductsService } from "./products/products.service";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        timestamp: stdTimeFunctions.isoTime,
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        customProps: () => {
          const ctx = getRequestContext();
          const props: Record<string, string> = {};
          if (ctx?.requestId) props.request_id = ctx.requestId;
          if (ctx?.traceparent) props.trace_id = ctx.traceparent.split("-")[1];
          return props;
        },
        autoLogging: {
          ignore: (req) => (req as { url?: string }).url === "/metrics",
        },
        serializers: {
          req: (req: { method?: string; url?: string }) => ({
            method: req.method,
            url: req.url,
          }),
          res: (res: { statusCode?: number }) => ({ status: res.statusCode }),
        },
      },
    }),
  ],
  controllers: [ProductsController, HealthController, MetricsController],
  providers: [
    DownstreamService,
    ProductsService,
    { provide: APP_CONFIG, useValue: loadConfig() },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
