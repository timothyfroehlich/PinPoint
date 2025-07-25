# TypeScript Migration Handoff Checklist

## Overview

This document provides a complete checklist for implementing the Betterer integration and CI pipeline reorganization.

## Pre-Implementation Checklist

### 1. Review Current State

- [ ] Read `TYPESCRIPT_MIGRATION.md` for current error counts and status
- [ ] Review `eslint.config.js` to understand baseline configuration
- [ ] Check current CI workflow in `.github/workflows/ci.yml`
- [ ] Verify all Zod deprecation fixes have been applied

### 2. Dependencies to Install

```bash
npm install --save-dev @betterer/cli @betterer/typescript @betterer/eslint
```

### 3. Files to Create/Update

#### New Files

- [ ] `.betterer.ts` - Betterer configuration (already created)
- [ ] `.github/workflows/ci-discrete.yml` - New CI pipeline (already created)
- [ ] `scripts/migrate-test-file.sh` - Migration helper (already created)
- [ ] `scripts/migrate-test-directory.sh` - Batch migration helper (already created)
- [ ] `scripts/README.md` - Scripts documentation (already created)

#### Files to Update

- [ ] `package.json` - Add Betterer scripts
- [ ] `eslint.config.js` - Add ban-ts-comment rule
- [ ] `.husky/pre-commit` - Add actionlint check
- [ ] `TYPESCRIPT_MIGRATION.md` - Add Betterer sections

## Implementation Steps

### Step 1: Install Dependencies

```bash
npm install --save-dev @betterer/cli @betterer/typescript @betterer/eslint
```

### Step 2: Update package.json

Add these scripts to the scripts section:

```json
"betterer": "betterer",
"betterer:check": "betterer ci --strict",
"betterer:update": "betterer update",
"betterer:watch": "betterer watch",
```

### Step 3: Update eslint.config.js

Add the ban-ts-comment rule to the main rules section:

```javascript
"@typescript-eslint/ban-ts-comment": ["error", {
  "ts-expect-error": "allow-with-description",
  "ts-ignore": true,
  "ts-nocheck": true,
  "ts-check": false,
  "minimumDescriptionLength": 10
}],
```

### Step 4: Create Initial Betterer Baseline

```bash
# This will create .betterer.results file
npm run betterer

# Commit the results file
git add .betterer.results
git commit -m "feat: add initial Betterer baseline for TypeScript migration"
```

### Step 5: Install actionlint

```bash
# macOS
brew install actionlint

# Linux (for CI or local development)
curl -L https://github.com/rhysd/actionlint/releases/latest/download/actionlint_Linux_x86_64.tar.gz | tar xz -C /usr/local/bin actionlint
```

### Step 6: Update .husky/pre-commit

Replace the contents with:

```bash
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"

# Run actionlint if available
if command -v actionlint &> /dev/null; then
    echo "🔍 Checking GitHub Actions workflows..."
    actionlint .github/workflows/*.yml || {
        echo "❌ GitHub Actions validation failed. Please fix the errors above."
        exit 1
    }
fi

# Run standard pre-commit
npm run validate
```

### Step 7: Test New CI Pipeline Locally

```bash
# Validate the new workflow file
actionlint .github/workflows/ci-discrete.yml

# Test individual jobs locally (requires act)
act -j typecheck
act -j lint-production
```

### Step 8: Deploy New CI Pipeline

1. Create a new branch for the CI changes
2. Delete or rename the old `.github/workflows/ci.yml`
3. Rename `ci-discrete.yml` to `ci.yml`
4. Push and create PR to test the new pipeline

### Step 9: Update TYPESCRIPT_MIGRATION.md

Add the new sections documented in the implementation plan:

- Betterer Integration status
- Ban-ts-comment Policy
- CI Pipeline Architecture

## Post-Implementation Verification

### 1. Verify Betterer Works

```bash
# Should show current state
npm run betterer

# Should pass (no regressions)
npm run betterer:check

# Make a test change that adds an error, then:
npm run betterer:check  # Should fail
```

### 2. Test Migration Scripts

```bash
# Test single file analysis
./scripts/migrate-test-file.sh src/test/mockContext.ts

# Test directory analysis
./scripts/migrate-test-directory.sh src/server/api/__tests__/
```

### 3. Verify CI Pipeline

- Push a commit to trigger CI
- Check that all jobs run in parallel
- Verify PR comment appears with migration progress
- Ensure Betterer prevents regressions

## Troubleshooting

### Common Issues

1. **Betterer not finding files**
   - Check glob patterns in `.betterer.ts`
   - Ensure TypeScript/ESLint can parse the files

2. **CI jobs failing with env errors**
   - Verify all required env vars are in each job
   - Check secrets are properly configured

3. **actionlint not found**
   - Install it locally or skip pre-commit check
   - CI will still validate workflows

4. **Migration scripts permission denied**
   - Run `chmod +x scripts/*.sh`

## Communication Template

### Slack/Team Message

```
🚀 TypeScript Migration Tooling Update

I've implemented Betterer and reorganized our CI pipeline to better support our TypeScript strict mode migration:

**What's New:**
• Betterer prevents regression on TypeScript/ESLint errors
• CI jobs now run in parallel for faster feedback
• New helper scripts for migrating test files
• PR comments show migration progress automatically

**Action Required:**
• Run `npm install` to get new dependencies
• Install actionlint: `brew install actionlint` (optional)
• Read docs/typescript-migration/betterer-integration-plan.md

**How to Use:**
• `npm run betterer:check` - Verify no regressions
• `./scripts/migrate-test-file.sh <file>` - Analyze a test file
• Check PR comments for migration progress

Let me know if you have any questions!
```

## Next Steps

1. **Immediate**: Get team buy-in on the new workflow
2. **This Sprint**: Migrate 2-3 test files as examples
3. **Next Sprint**: Set team goal for error reduction
4. **Ongoing**: Monitor Betterer results in PRs

## Resources

- [Betterer Documentation](https://phenomnomnominal.github.io/betterer/)
- [TypeScript Strict Mode Guide](https://www.typescriptlang.org/tsconfig#strict)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/guides)
