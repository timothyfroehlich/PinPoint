# CI Workflow Setup

This document describes the high-level CI workflow used for PinPoint.  
The actual configuration lives in `.github/workflows/ci.yml` and is committed to the repository.

## What CI Runs

On pushes and pull requests to `main`:

- **Install & Cache Dependencies**
  - Runs `pnpm install`
  - Caches `pnpm` store and Playwright browsers for faster subsequent runs
- **Quality Checks (Parallel)**
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run format`
- **Build**
  - `pnpm run build` (runs after quality checks pass)
- **Tests**
  - Unit tests: `pnpm test`
  - Integration tests: `pnpm run test:integration`
  - Smoke E2E tests: `pnpm run smoke` (after a successful build)
- **Artifacts**
  - Uploads Playwright reports on E2E failures to aid debugging

## Local Equivalent

Before pushing, run:

```bash
pnpm run preflight
```

This mirrors the CI pipeline locally (typecheck, lint, format, tests, build, integration tests, smoke tests).
