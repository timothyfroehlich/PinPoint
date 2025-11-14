# CI Workflow Setup

**Status**: Requires manual GitHub UI addition due to workflow permissions

## Background

The GitHub Actions CI workflow cannot be pushed via git due to GitHub App security restrictions. Workflow files (`.github/workflows/*.yml`) require explicit workflow permissions.

## CI Workflow Location

The workflow file is available locally at:

```
.github/workflows/ci.yml
```

## To Add the CI Workflow

### Option 1: Via GitHub Web UI (Recommended)

1. Go to your repository on GitHub: `https://github.com/timothyfroehlich/PinPoint`
2. Click **"Add file"** → **"Create new file"**
3. Enter file path: `.github/workflows/ci.yml`
4. Copy the contents from your local `.github/workflows/ci.yml`
5. Commit directly to `claude/first-task-start-011CUyZWAxEoRWPJr2WGGvA3` branch

### Option 2: Grant Workflow Permissions

1. Go to GitHub App settings
2. Grant "workflows" permission to the Claude Code app
3. Run: `git push origin claude/first-task-start-011CUyZWAxEoRWPJr2WGGvA3`

## CI Workflow Contents

The workflow includes the following jobs:

### Setup & Caching

- **Setup Dependencies** - Installs npm packages and caches node_modules for other jobs

### Quality Checks (Parallel, depends on setup)

- **TypeScript Type Check** - `npm run typecheck`
- **ESLint** - `npm run lint`
- **Prettier Format Check** - `npm run format`

### Build (Sequential, after quality checks)

- **Build** - `npm run build` (depends on typecheck, lint, format passing)

### Testing (Parallel for unit/integration, sequential for E2E)

- **Unit Tests** - `npm test` (depends on setup)
- **Integration Tests** - `npm run test:integration` (depends on setup)
  - Sources `.env.ci` before running to provide Supabase + database env vars
- **E2E Tests (Smoke)** - `npm run smoke` (depends on setup + build)
  - Installs Playwright browsers
  - Caches `~/.cache/ms-playwright` to avoid repeated downloads
  - Sources `.env.ci` before running smoke tests so Playwright's built-in `webServer` command launches Next.js with the right config
  - Uploads Playwright report on failure

### Security Scans (Independent)

- **Gitleaks** - Secret detection in git history (no dependencies)
- **npm audit** - Dependency vulnerability checking (depends on setup)

### Triggers

- Push to `main` or `claude/**` branches
- Pull requests to `main`

### Node.js Version

- **Node 22** with npm caching and node_modules caching for efficiency

## Performance Optimizations

### Dependency Caching Strategy

The workflow uses a two-level caching approach:

1. **npm cache** - Caches downloaded packages from npm registry (via `actions/setup-node`)
2. **node_modules cache** - Caches installed dependencies for direct reuse (via `actions/cache`)

This reduces `npm ci` time from ~30s to ~5s for dependent jobs.

### Job Orchestration

- **Parallel execution**: Quality checks (typecheck, lint, format) and unit/integration tests run concurrently
- **Sequential gates**: Build job waits for quality checks to pass first
- **E2E optimization**: Smoke tests only run after successful build

### Concurrency Control

Workflow runs are automatically cancelled when new commits are pushed to the same branch, preventing wasted CI minutes on outdated code.

## Artifacts & Debugging

- **Playwright Reports**: Automatically uploaded on E2E test failures (retained for 7 days)
- **Test Output**: Verbose reporter enabled for easier debugging
- **Failure Analysis**: Check the "Artifacts" section in failed workflow runs

## Verification

Once added, verify the workflow:

1. Go to **Actions** tab in GitHub
2. Look for "CI" workflow
3. Check that all jobs pass

## Local Testing

Before pushing, run locally:

```bash
npm run preflight
```

This runs all quality gates (typecheck, test, smoke, lint, format).
