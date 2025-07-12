# Task 02: Delete Playwright Tests

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

## Workflow

- **Base Branch**: `feature/phase-1a-backend-refactor`
- **Task Branch**: `task/02-delete-playwright-tests`
- **PR Target**: `feature/phase-1a-backend-refactor` (NOT main)

## Dependencies

- Task 00 (Feature Branch Setup) must be completed
- No other task dependencies (can run in parallel with Task 01)

## Objective

Remove existing Playwright E2E tests since the frontend will be completely rebuilt. New tests will be created for the new frontend architecture.

## Status

- [ ] In Progress
- [ ] Completed

## Implementation Steps

### 1. Identify Playwright Files

```bash
# Find all Playwright-related files
find . -name "*playwright*" -type f
find . -name "*.spec.ts" -o -name "*.e2e.ts" | grep -v node_modules
find . -name "tests" -type d
```

### 2. Remove Playwright Configuration

```bash
# Remove Playwright config files
rm -f playwright.config.ts
rm -f playwright.config.js
```

### 3. Remove Test Files (Batch Operation)

```bash
# Remove E2E test directories
rm -rf tests/
rm -rf e2e/
rm -rf src/**/*.spec.ts
rm -rf src/**/*.e2e.ts

# Find and remove any remaining playwright tests
find . -name "*.spec.ts" -not -path "./node_modules/*" -delete
find . -name "*.e2e.ts" -not -path "./node_modules/*" -delete
```

### 4. Update Package.json

Remove Playwright dependencies and scripts:

```bash
# Remove playwright dependencies (check package.json first)
npm uninstall @playwright/test playwright

# Remove any playwright-related scripts from package.json
# This requires manual editing
```

### 5. Update CI/CD Configuration

Check and update:

- [ ] `.github/workflows/*.yml` - Remove Playwright steps
- [ ] Any Docker configurations that install Playwright
- [ ] Deployment scripts referencing E2E tests

### 6. Update npm Scripts

Edit `package.json` to remove:

- `test:e2e`
- `test:playwright`
- `playwright:install`
- Any other Playwright-related scripts

## Manual Cleanup Required

After batch operations, manually:

- [ ] Edit package.json to remove Playwright scripts
- [ ] Check .gitignore for Playwright entries that can be removed
- [ ] Update README.md if it references Playwright testing
- [ ] Check if any CI/CD configs reference removed test commands

## Files to Manually Check

- `package.json` - Dependencies and scripts
- `.github/workflows/` - CI configurations
- `README.md` - Documentation references
- `.gitignore` - Playwright-specific entries

## Validation Steps

```bash
# Verify no Playwright files remain
find . -name "*playwright*" -not -path "./node_modules/*"

# Check that npm scripts work
npm run build
npm run test  # Should not include E2E tests

# Verify no TypeScript errors from missing Playwright types
npm run typecheck
```

## Progress Notes

<!-- Agent: Update this section with implementation decisions and complexity encountered -->

### Implementation Decisions Made:

-

### Unexpected Complexity:

-

### Dependencies to Remove:

-

### CI/CD Changes Made:

-

### Notes for Later Tasks:

- New E2E testing strategy will be needed for rebuilt frontend
- Consider different testing framework for new architecture
-

## Rollback Procedure

If Playwright needs to be restored:

```bash
# Reinstall Playwright
npm install -D @playwright/test

# Restore config from git history
git checkout HEAD~1 -- playwright.config.ts

# Note: Test files will need to be restored from git history manually
```
