# Functional tests

Black-box tests for the **whole Demo Commerce Platform**, executed
against the running Docker Compose stack (or any reachable deployment).

## Run

```bash
# 1. bring the platform up (from the repo root)
docker compose -f deploy/platform/docker-compose.yaml up -d --build

# 2. create the test env once
python3 -m venv .venv-func
.venv-func/bin/pip install -r tests/functional/requirements.txt

# 3. run everything
.venv-func/bin/pytest tests/functional -v

# skip the resilience tests (they stop/start compose services)
.venv-func/bin/pytest tests/functional -v -m "not resilience"
```

## Suites

| File | Covers |
| ---- | ------ |
| `test_health.py` | `/healthz`, `/readyz`, `/metrics` on all four backends |
| `test_catalog.py` | catalog list, aggregate view, 404s, nginx `/api/` proxy, SPA assets |
| `test_contract.py` | strict field/type conformance vs `docs/api/openapi.yaml` |
| `test_headers.py` | `X-Request-ID` echo/generation, `traceparent` acceptance, content types |
| `test_resilience.py` | degraded mode (reviews/ratings down → `degraded:true`), details down → 502, recovery, `FAIL_READINESS` env → 503 |

## Targeting another environment

All URLs are env-overridable, so the same suite works against
port-forwards or a cluster ingress:

```bash
WEB_URL=http://minikube:30080 \
PRODUCT_API_URL=http://minikube:30081 \
DETAILS_API_URL=... REVIEWS_API_URL=... RATINGS_API_URL=... \
  pytest tests/functional -m "not resilience"
```

(`resilience` tests always require the local compose stack.)
