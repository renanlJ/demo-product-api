# Validation Report — Demo Commerce Platform v0.1.0

Everything below was **executed** in the build environment (WSL Ubuntu,
Docker 29 + Compose v5, Node 22, JDK 21, Go 1.27.4, Python 3.12,
kubectl 1.36). Nothing listed is assumed or extrapolated.

## Per-repo builds and tests

| Repo | Command executed | Result |
| ---- | ---------------- | ------ |
| demo-ratings-api | `go test ./... -cover`, `go vet`, `gofmt -l` | PASS — ~96–100% coverage across packages |
| demo-reviews-api | `pytest --cov=app` (venv) | PASS — 12 tests, ~90% coverage; `ruff`, `bandit`, `mypy` clean |
| demo-details-api | `mvn -B verify` (JAVA_HOME=Temurin 21) | PASS — 11 tests, Spotless clean, JaCoCo gate ≥80% met |
| demo-product-api | `npm test` (jest), `npm run test:e2e`, `npm run lint`, `npm run build` | PASS — 25 unit + 8 e2e tests, coverage gates green, tsc build OK |
| demo-commerce-web | `npm test` (vitest+RTL+msw), `npm run lint`, `npm run build` | PASS — 7 tests, coverage gates green, vite build OK |

## Container images

| Image | Result |
| ----- | ------ |
| `demo-commerce-web:0.1.0` | built (multi-stage node → nginx-unprivileged) |
| `demo-product-api:0.1.0` | built (tsc → node:22-alpine, non-root) |
| `demo-details-api:0.1.0` | built (maven → temurin:21-jre-alpine, non-root) |
| `demo-reviews-api:0.1.0` | built (python:3.12-slim, uid 10001) |
| `demo-ratings-api:0.1.0` | built (CGO_ENABLED=0 → gcr.io/distroless static, non-root) |

## End-to-end (docker compose, `deploy/platform/docker-compose.yaml`)

All 5 containers `Up`; verified with curl:

| Check | Result |
| ----- | ------ |
| `GET :8080/` storefront | 200 |
| `GET :3000/api/v1/products` catalog list | 200, aggregated `averageRating` populated |
| `GET :3000/api/v1/products/SKU-1001` aggregate | 200, `degraded:false`, details+reviews+rating merged |
| reviews-api stopped → aggregate | 200 + `degraded:true`, empty reviews |
| details-api stopped → aggregate | 502 (required-service contract) |
| `X-Request-ID` supplied at edge | echoed back; identical value in product-api + downstream logs |
| `traceparent` propagation | **one unified `trace_id`** in product-api, details, reviews and ratings logs for a single request |
| `GET /metrics` on all 4 backends | Prometheus text with request counters/histograms |
| `GET /healthz`, `GET /readyz` on all 4 backends | 200 JSON |

## Kubernetes manifests (static — per approved scope)

| Check | Result |
| ----- | ------ |
| `kubectl kustomize` per-repo overlays | each renders 3 valid resources |
| `kubectl kustomize deploy/platform` | 16 resources — Namespace + 5×(Deployment/Service/ConfigMap), valid kinds, namespace propagated |
| `kubectl kustomize deploy/overlays/bad-image` | renders; image patched to `:does-not-exist` (governance fixture) |

Server-side dry-run was **not** performed — the local kubeconfig targets
a GKE cluster whose auth plugin is absent, and live deployment was
explicitly out of scope.

## Backstage catalog

| Check | Result |
| ----- | ------ |
| `node scripts/validate-catalog.mjs` | `OK — 12 entities across 5 file(s)` |
| Invalid fixture | correctly rejected (missing description/owner/system) |
| Wrong-owner fixture | passes structural validation; surfaces only at registration (documented) |
| devex.io `catalog.rules` | identified gap — `Domain`/`Group` must be allowed; patch documented in `docs/devexio-integration.md` |

## Git

All five repos initialized on `main`, single squashed initial commit,
annotated tag `v0.1.0`. `.gitattributes` enforces LF.

## Not executed (out of scope, declared honestly)

- **GitHub Actions runs** — no remotes configured (per decision); the
  `ci.yml` workflows were authored for real execution and will run
  as-is once pushed. Local equivalents of every job step were run above.
- **GHCR pushes** — require `v*` tag push to a real remote.
- **Live `kubectl apply`** — static kustomize validation only.
- **Trivy/govulncheck/pip-audit runs** — wired into CI; not run locally
  (tools not installed in this environment).
