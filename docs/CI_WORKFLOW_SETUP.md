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

### Quality Checks

- **TypeScript Type Check** - `npm run typecheck`
- **ESLint** - `npm run lint`
- **Prettier Format Check** - `npm run format`
- **Build** - `npm run build`

### Testing

- **Unit & Integration Tests** - `npm test`

### Security Scans

- **Gitleaks** - Secret detection in git history
- **npm audit** - Dependency vulnerability checking (high severity only)

### Triggers

- Push to `main` or `claude/**` branches
- Pull requests to `main`

### Node.js Version

- **Node 22** with npm caching enabled

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
