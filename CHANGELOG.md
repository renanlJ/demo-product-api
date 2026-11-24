# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-24

### Added

- `GET /api/v1/products` and `GET /api/v1/products/{productId}` aggregation
  endpoints orchestrating the details, reviews and ratings services with
  graceful degradation (`degraded` flag, 502/404 propagation).
- `/healthz`, `/readyz` (aggregates downstream health) and `/metrics` platform
  endpoints (`FAIL_READINESS` env var forces readiness failure for governance
  scenarios).
- Structured JSON logging (nestjs-pino) with `request_id` and `trace_id`;
  AsyncLocalStorage-based request context propagated downstream as
  `X-Request-ID` + W3C `traceparent`.
- Prometheus metrics via prom-client; OpenTelemetry NodeSDK gated by
  `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Platform deployment assets under `deploy/platform`: docker-compose stack,
  umbrella kustomization, Backstage location snippet.
- Multi-stage Dockerfile, Kubernetes manifests (`deploy/kubernetes`) and
  Backstage catalog descriptor (`catalog-info.yaml`) including the
  `commerce` domain, `demo-commerce` system and `platform-team` group
  entities.
- GitHub Actions CI pipeline (`.github/workflows/ci.yml`).
