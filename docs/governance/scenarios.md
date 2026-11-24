# Governance Test Scenarios

Deterministic recipes for exercising devex.io quality gates, pipeline
stages and catalog rules. Every scenario is isolated, reversible and
never built into container images. Fixtures live in
`deploy/platform/fixtures/`.

Run commands from the named repository root unless stated otherwise.

## 1. Successful pipeline execution

Baseline — every repo is green on a clean checkout:

```bash
# ratings-api  (Go)
go test ./... -race -coverprofile=coverage.out -covermode=atomic
# reviews-api  (FastAPI)
.venv/bin/pytest --cov=app --cov-report=xml
# details-api  (Spring Boot)
JAVA_HOME=~/sdk/jdk-21* mvn -B verify        # spotless + tests + jacoco
# product-api  (NestJS)
npm ci && npm run lint && npm test && npm run test:e2e && npm run build
# commerce-web (React)
npm ci && npm run lint && npm test && npm run build
```

## 2. Unit test failure

```bash
# Deterministic: break an assertion, run tests, revert.
# Example — ratings-api:
sed -i 's/Average: 4.43/Average: 9.99/' internal/handler/handler_test.go
go test ./...        # fails
git checkout -- internal/handler/handler_test.go
```

Equivalent for other repos: flip an expected value in any `*.spec.ts`,
`test_*.py` or `*Test.java`, run the suite, `git checkout` to reset.

## 3. Code coverage below threshold

Coverage gates are already enforced; lower/raise them to demo both sides:

```bash
# reviews-api — failUnder lives in pyproject.toml [tool.coverage.report]
.venv/bin/pytest --cov=app --cov-fail-under=99     # forces the gate to fail
.venv/bin/pytest --cov=app --cov-fail-under=80     # passes

# product-api — jest coverageThreshold in package.json
npx jest --coverage --coverageThreshold='{"global":{"lines":99}}'
# details-api — jacoco gate in pom.xml (jacoco-check, line coverage >= 0.80)
JAVA_HOME=~/sdk/jdk-21* mvn verify -Djacoco.haltOnFailure=true
```

## 4. Linting failure

```bash
# ratings-api
printf 'package main\n\nfunc unused() {}\n' >> cmd/ratings-api/extra.go
go vet ./...   # and/or gofmt -l .
rm cmd/ratings-api/extra.go

# product-api
echo 'const x: any = 1; console.log(x);' > src/scenario-lint.ts
npm run lint    # eslint fails on `any`/console
rm src/scenario-lint.ts

# details-api — break googleJavaFormat:
#   edit any .java file, misindent a line, then:
JAVA_HOME=~/sdk/jdk-21* mvn spotless:check   # fails; `mvn spotless:apply` to fix
```

## 5. Dependency vulnerability detection

Uses the pinned fixture — nothing is installed:

```bash
pip install pip-audit
pip-audit -r deploy/platform/fixtures/requirements-vulnerable.txt
# deterministic findings on urllib3 1.24.1 / requests 2.19.0

# npm variant — temporarily downgrade a lockfile entry, then:
npm audit --audit-level=high
git checkout -- package-lock.json            # reset
```

## 6. Container image scanning findings

```bash
# Scan an older tag / the fixture base — deterministic, no app changes:
trivy image python:3.8-slim --severity HIGH,CRITICAL
# or scan the real images and compare baseline drift:
trivy image demo-ratings-api:0.1.0
```

## 7. Build failure

```bash
# Compile-level break, then revert:
echo 'this is not go' >> cmd/ratings-api/extra.go && go build ./... ; rm cmd/ratings-api/extra.go
echo 'not valid ts'  >> src/broken.ts        && npm run build    ; rm src/broken.ts
JAVA_HOME=~/sdk/jdk-21* mvn -B package -DskipTests   # after breaking any .java
```

Docker-level: `docker build -f Dockerfile .` after truncating the file —
reset with `git checkout -- Dockerfile`.

## 8. Deployment failure

Static (no cluster needed):

```bash
kubectl kustomize deploy/overlays/bad-image   # renders with a bogus tag
# Live cluster variant — ImagePullBackOff via bad tag patch:
kubectl -n demo-commerce patch deployment demo-ratings-api --type=json \
  -p '[{"op":"replace","path":"/spec/template/spec/containers/0/image","value":"ghcr.io/renanlj/demo-ratings-api:does-not-exist"}]'
kubectl -n demo-commerce rollout undo deployment/demo-ratings-api   # reset
```

## 9. Application health check failure

Every backend ships a `FAIL_READINESS` env var:

```bash
# Docker Compose (from this repo):
FAIL_READINESS=true docker compose -f deploy/platform/docker-compose.yaml \
  up -d demo-ratings-api
curl -i localhost:8083/readyz        # 503 — readiness gate fires
docker compose -f deploy/platform/docker-compose.yaml up -d demo-ratings-api  # reset

# Kubernetes: set FAIL_READINESS: "true" in the service ConfigMap and
# `kubectl rollout restart` — readiness probe fails, pod never goes Ready.
```

## 10. API communication failure

```bash
# Stop a downstream — orchestrator degrades gracefully (200 + degraded:true):
docker compose -f deploy/platform/docker-compose.yaml stop demo-reviews-api
curl -s localhost:3000/api/v1/products/SKU-1001 | python3 -m json.tool

# Stop the required service — hard failure (502):
docker compose -f deploy/platform/docker-compose.yaml stop demo-details-api
curl -i localhost:3000/api/v1/products/SKU-1001

docker compose -f deploy/platform/docker-compose.yaml up -d   # reset
```

## 11. Missing or invalid catalog metadata

```bash
node scripts/validate-catalog.mjs \
  deploy/platform/fixtures/catalog-info-invalid.yaml
# → FAIL: metadata.description, spec.owner, spec.system missing

# Registering the fixture file in Backstage reproduces the same class of
# error via the catalog processor logs.
```

## 12. Incorrect ownership metadata

```bash
node scripts/validate-catalog.mjs \
  deploy/platform/fixtures/catalog-info-wrong-owner.yaml <real catalog files>
# passes structural validation — the defect surfaces in Backstage, which
# cannot resolve `group:default/nonexistent-team` and flags the entity.
```

## 13. Outdated dependencies

```bash
npm outdated                    # product-api / commerce-web
pip list --outdated             # reviews-api (inside .venv)
JAVA_HOME=~/sdk/jdk-21* mvn versions:display-dependency-updates   # details-api
go list -m -u all               # ratings-api
```

## Safety notes

- Fixtures are never referenced by Dockerfiles, compose, kustomize or CI —
  they are inert until deliberately fed to a scanner.
- No real secrets or exploitable services are introduced anywhere; the
  "vulnerable" requirements file is only ever *scanned*, never installed.
- Every scenario lists its reset command; `git checkout --` restores any
  mutated source file.
