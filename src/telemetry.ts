/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * OpenTelemetry bootstrap. Executed for side effects on `import './telemetry'`
 * BEFORE Nest/express are imported so auto-instrumentation can patch them.
 * No-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set.
 */
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  const { NodeSDK } = require("@opentelemetry/sdk-node");
  const {
    getNodeAutoInstrumentations,
  } = require("@opentelemetry/auto-instrumentations-node");
  const {
    OTLPTraceExporter,
  } = require("@opentelemetry/exporter-trace-otlp-http");

  // service.name is picked up from OTEL_SERVICE_NAME / OTEL_RESOURCE_ATTRIBUTES.
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  process.on("SIGTERM", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
