# demo-product-api

Orchestration API for the **Demo Commerce Platform** — a polyglot
reference workload for devex.io (Backstage-based IDP). The only backend
the storefront talks to; fans out to details, reviews and ratings
services with graceful degradation.

- **Language**: TypeScript / Node.js 22
- **Framework**: NestJS 11, pino, prom-client, axios, OpenTelemetry SDK
- **Role**: orchestrator — also the **platform anchor repo**: it owns the
  shared Backstage entities (Domain/System/Group), `docker-compose.yaml`,
  the umbrella kustomization, the catalog validator and the governance
  scenario docs.
- **Part of**: `system: demo-commerce` / `domain: commerce` (see `catalog-info.yaml`)

## API

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/v1/products` | Catalog list with averaged ratings (`averageRating` may be `null`) |
| GET | `/api/v1/products/{productId}` | Aggregated view: details + reviews + rating + `degraded` flag |
| GET | `/healthz` | Liveness |
| GET | `/readyz` | Readiness |
| GET | `/metrics` | Prometheus exposition |

Degradation contract: details-api down → **502**; reviews/ratings down →
**200** with `degraded: true` and the missing fields empty/null.

OpenAPI contract: [`docs/api/openapi.yaml`](docs/api/openapi.yaml)

## Configuration

| Env var | Default | Description |
| ------- | ------- | ----------- |
| `PORT` | `3000` | Listen port |
| `LOG_LEVEL` | `info` | pino level |
| `FAIL_READINESS` | `false` | Force `/readyz` → 503 |
| `DETAILS_API_URL` | `http://localhost:8081` | demo-details-api base URL |
| `REVIEWS_API_URL` | `http://localhost:8000` | demo-reviews-api base URL |
| `RATINGS_API_URL` | `http://localhost:8083` | demo-ratings-api base URL |
| `DOWNSTREAM_TIMEOUT_MS` | `2000` | Per-downstream request timeout |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | _(empty)_ | Enable OTLP trace export when set |

## Develop

```bash
npm ci
npm run start:dev      # tsx watch
npm test               # jest unit tests + coverage gate
npm run test:e2e       # e2e against nock-mocked downstreams
npm run lint format    # eslint / prettier --check
npm run build          # tsc → dist/
```

## Docker — whole platform

```bash
docker compose -f deploy/platform/docker-compose.yaml up -d --build
curl localhost:8080                    # storefront
curl localhost:3000/api/v1/products    # aggregated API
docker compose -f deploy/platform/docker-compose.yaml down
```

## Kubernetes — whole platform

```bash
kubectl kustomize deploy/platform      # render all 5 services + namespace
kubectl apply -k deploy/platform       # deploy into demo-commerce ns
```

(Requires all five repos checked out as siblings — the same layout the
compose file assumes.)

## Observability

- pino JSON logs with `request_id` + `trace_id`; a root `traceparent` is
  generated at the edge and propagated to every downstream, so one
  request shares a single `trace_id` across all services.
- prom-client metrics on `/metrics`; OTel SDK activates when
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

## Catalog validation

```bash
node scripts/validate-catalog.mjs          # all sibling repos
```

Checks structure, required fields per entity kind, and cross-entity
references (system, domain, provided/consumed APIs, dependsOn).

## Governance

`docs/governance/scenarios.md` — deterministic recipes for pipeline,
deployment, health, catalog and dependency failure modes.
`docs/architecture.md` — platform architecture and contracts.
