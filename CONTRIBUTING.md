# Contributing

## Development setup

Requires Node.js 22+.

```sh
npm ci
npm test          # unit tests + coverage gates
npm run test:e2e  # e2e tests with nock-mocked downstreams
npm run start:dev # tsx watch mode
```

`make` targets wrap the same commands but a local `make` is not required.

## Conventions

- `eslint` and `prettier --check` must pass (`npm run format:write` to fix).
- Downstream URLs, ports and timeouts are configured via environment
  variables only — never hardcode service locations.
- Commits: imperative mood, concise subject line.
- Update `CHANGELOG.md` under `Unreleased` for user-visible changes.

## Pull requests

- CI must be green: lint, format, unit + e2e tests, coverage >= 80%, Trivy
  image scan.
- Keep PRs focused; link related issues.
