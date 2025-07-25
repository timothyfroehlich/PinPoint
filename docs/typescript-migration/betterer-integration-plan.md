# Betterer Integration and CI Pipeline Reorganization Plan

## Overview

This document outlines the integration of Betterer for TypeScript migration tracking while maintaining our ESLint baseline approach and reorganizing GitHub Actions into discrete, focused jobs.

## Current State

- **TypeScript Errors**: 121 (mostly in test files)
- **ESLint Warnings**: 111 (46 type-safety related)
- **Baseline Strategy**: ESLint configured with warnings for test files, errors for production code
- **CI Pipeline**: Single lint job running all validations

## Implementation Plan

### Phase 1: Betterer Setup

#### 1.1 Install Dependencies

```bash
npm install --save-dev @betterer/cli @betterer/typescript @betterer/eslint
```

#### 1.2 Create `.betterer.ts` Configuration

```typescript
import { typescript } from "@betterer/typescript";
import { eslint } from "@betterer/eslint";

export default {
  // Track TypeScript strict mode errors
  "typescript strict mode": () =>
    typescript("./tsconfig.json", {
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
    }).include("./src/**/*.{ts,tsx}"),

  // Track specific ESLint rules for production code
  "no explicit any (production)": () =>
    eslint({ "@typescript-eslint/no-explicit-any": "error" })
      .include("./src/**/*.{ts,tsx}")
      .exclude("./src/**/*.test.{ts,tsx}")
      .exclude("./src/**/__tests__/**"),

  // Track unsafe operations in production code
  "no unsafe operations (production)": () =>
    eslint({
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    })
      .include("./src/**/*.{ts,tsx}")
      .exclude("./src/**/*.test.{ts,tsx}")
      .exclude("./src/**/__tests__/**"),

  // Separate tracking for test files
  "no explicit any (tests)": () =>
    eslint({ "@typescript-eslint/no-explicit-any": "error" })
      .include("./src/**/*.test.{ts,tsx}")
      .include("./src/**/__tests__/**"),

  // Track unbound method issues
  "no unbound method": () =>
    eslint({ "@typescript-eslint/unbound-method": "error" }).include(
      "./src/**/*.{ts,tsx}",
    ),
};
```

#### 1.3 Add npm Scripts

Update `package.json`:

```json
{
  "scripts": {
    // Existing scripts...
    "betterer": "betterer",
    "betterer:check": "betterer ci --strict",
    "betterer:update": "betterer update",
    "betterer:watch": "betterer watch",
    // Update pre-commit to include actionlint
    "pre-commit": "npm run validate && actionlint .github/workflows/*.yml"
  }
}
```

### Phase 2: Enhanced ESLint Configuration

#### 2.1 Add ban-ts-comment Rule

Update `eslint.config.js` to add the ban-ts-comment rule:

```javascript
// In the main rules section
"@typescript-eslint/ban-ts-comment": ["error", {
  "ts-expect-error": "allow-with-description",
  "ts-ignore": true,
  "ts-nocheck": true,
  "ts-check": false,
  "minimumDescriptionLength": 10
}],
```

### Phase 3: GitHub Actions Reorganization

#### 3.1 Create Discrete CI Jobs

Create `.github/workflows/ci-discrete.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]

# Cancel in-progress runs for the same branch
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # Job 1: TypeScript Type Checking
  typecheck:
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - name: TypeScript Check
        id: typecheck
        run: |
          npm run typecheck 2>&1 | tee typescript-output.log || true
          ERROR_COUNT=$(grep -c "error TS" typescript-output.log || echo "0")
          echo "error_count=$ERROR_COUNT" >> $GITHUB_OUTPUT
          echo "## TypeScript Check Results" >> $GITHUB_STEP_SUMMARY
          echo "Found $ERROR_COUNT TypeScript errors" >> $GITHUB_STEP_SUMMARY
          if [ $ERROR_COUNT -gt 0 ]; then
            echo "### First 10 errors:" >> $GITHUB_STEP_SUMMARY
            grep "error TS" typescript-output.log | head -10 >> $GITHUB_STEP_SUMMARY
            exit 1
          fi
      - name: Upload TypeScript Error Report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: typescript-errors
          path: typescript-output.log

  # Job 2: ESLint Linting (Split into production and test)
  lint-production:
    name: ESLint (Production)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - name: ESLint Check - Production Code
        run: |
          npm run lint -- --ignore-pattern "**/*.test.ts" --ignore-pattern "**/*.test.tsx" --ignore-pattern "**/__tests__/**"

  lint-tests:
    name: ESLint (Tests)
    runs-on: ubuntu-latest
    continue-on-error: true # Don't fail CI for test warnings
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - name: ESLint Check - Test Files
        id: lint-tests
        run: |
          npm run lint -- src/**/*.test.ts src/**/*.test.tsx src/**/__tests__/** 2>&1 | tee eslint-test-output.log || true
          WARNING_COUNT=$(grep -c "warning" eslint-test-output.log || echo "0")
          echo "warning_count=$WARNING_COUNT" >> $GITHUB_OUTPUT
          echo "## ESLint Test Files Report" >> $GITHUB_STEP_SUMMARY
          echo "Found $WARNING_COUNT warnings in test files" >> $GITHUB_STEP_SUMMARY

  # Job 3: Prettier Formatting
  format:
    name: Prettier
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - name: Prettier Check
        run: npm run format:check

  # Job 4: Betterer Regression Check
  betterer:
    name: Betterer
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - name: Betterer Check
        id: betterer
        run: |
          npm run betterer:check 2>&1 | tee betterer-output.log || BETTERER_EXIT=$?
          if [ "$BETTERER_EXIT" = "2" ]; then
            echo "❌ Betterer found regressions!" >> $GITHUB_STEP_SUMMARY
            grep "got worse" betterer-output.log >> $GITHUB_STEP_SUMMARY || true
            exit 1
          elif [ "$BETTERER_EXIT" = "0" ]; then
            echo "✅ No regressions found" >> $GITHUB_STEP_SUMMARY
          fi
      - name: Upload Betterer Diff
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: betterer-diff
          path: |
            .betterer.results
            betterer-output.log

  # Job 5: Tests with Coverage
  test:
    name: Tests
    runs-on: ubuntu-latest
    env:
      AUTH_SECRET: "temp_secret_value"
      DATABASE_URL: "sqlite://temp_db.sqlite"
      OPDB_API_TOKEN: "temp_opdb_token"
      DEFAULT_ORG_SUBDOMAIN: "apc"
      NODE_ENV: "test"
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - name: Run Tests with Coverage
        run: npm run test:coverage
      - name: Upload Coverage
        uses: codecov/codecov-action@v5
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
          fail_ci_if_error: true

  # Job 6: Security Audit
  security:
    name: Security
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - name: Security Audit
        run: npm audit --audit-level=high

  # Job 7: Validate GitHub Actions
  validate-actions:
    name: Validate Actions
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate GitHub workflows
        uses: raven-actions/actionlint@v2

  # Job 8: Migration Progress Report (PR only)
  migration-report:
    name: Migration Progress
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    needs: [typecheck, lint-production, lint-tests, betterer]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
      - run: npm ci
      - name: Generate Migration Report
        run: |
          # Update stats
          ./scripts/update-typescript-stats.sh

          # Create PR comment
          cat > migration-report.md << 'EOF'
          ## 📊 TypeScript Migration Progress Report

          EOF

          # Extract current stats
          grep -A 5 "### Error Counts" TYPESCRIPT_MIGRATION.md >> migration-report.md

          # Add Betterer status
          echo "" >> migration-report.md
          echo "### Betterer Status" >> migration-report.md
          if npm run betterer:check > /dev/null 2>&1; then
            echo "✅ No regressions detected" >> migration-report.md
          else
            echo "⚠️ Check Betterer results for details" >> migration-report.md
          fi

          # Add helpful links
          echo "" >> migration-report.md
          echo "---" >> migration-report.md
          echo "📖 [Migration Guide](./TYPESCRIPT_MIGRATION.md) | 🔧 [Helper Scripts](./scripts/README.md)" >> migration-report.md

      - name: Comment PR
        uses: actions/github-script@v7
        if: always()
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('migration-report.md', 'utf8');

            // Find existing comment
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const botComment = comments.find(comment => 
              comment.user.type === 'Bot' && 
              comment.body.includes('TypeScript Migration Progress Report')
            );

            if (botComment) {
              // Update existing comment
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: botComment.id,
                body: report,
              });
            } else {
              // Create new comment
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: report,
              });
            }

  # Summary job to ensure all checks pass
  ci-summary:
    name: CI Summary
    runs-on: ubuntu-latest
    needs:
      [
        typecheck,
        lint-production,
        format,
        betterer,
        test,
        security,
        validate-actions,
      ]
    if: always()
    steps:
      - name: Check Results
        run: |
          if [ "${{ needs.typecheck.result }}" != "success" ] ||
             [ "${{ needs.lint-production.result }}" != "success" ] ||
             [ "${{ needs.format.result }}" != "success" ] ||
             [ "${{ needs.betterer.result }}" != "success" ] ||
             [ "${{ needs.test.result }}" != "success" ] ||
             [ "${{ needs.security.result }}" != "success" ] ||
             [ "${{ needs.validate-actions.result }}" != "success" ]; then
            echo "❌ One or more required checks failed"
            exit 1
          else
            echo "✅ All required checks passed"
          fi
```

### Phase 4: Migration Helper Scripts

#### 4.1 Create Migration Helper Script

Create `scripts/migrate-test-file.sh`:

```bash
#!/bin/bash
# migrate-test-file.sh - Helper script to migrate a test file from warnings to errors
# Usage: ./scripts/migrate-test-file.sh path/to/test.file.ts

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <test-file-path>"
    echo "Example: $0 src/server/api/__tests__/trpc-auth.test.ts"
    exit 1
fi

FILE=$1

if [ ! -f "$FILE" ]; then
    echo "Error: File '$FILE' not found"
    exit 1
fi

echo "🔍 Analyzing $FILE for migration to strict mode..."
echo ""

# Create temporary tsconfig for strict checking this file
TEMP_TSCONFIG=$(mktemp)
cat > "$TEMP_TSCONFIG" << EOF
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["$FILE"]
}
EOF

# Run TypeScript check
echo "📋 TypeScript strict mode check:"
echo "================================"
npx tsc --noEmit --project "$TEMP_TSCONFIG" || true
echo ""

# Run ESLint with strict rules
echo "📋 ESLint strict rules check:"
echo "============================="
npx eslint "$FILE" \
  --rule '@typescript-eslint/no-explicit-any: error' \
  --rule '@typescript-eslint/no-unsafe-assignment: error' \
  --rule '@typescript-eslint/no-unsafe-argument: error' \
  --rule '@typescript-eslint/no-unsafe-call: error' \
  --rule '@typescript-eslint/no-unsafe-member-access: error' \
  --rule '@typescript-eslint/no-unsafe-return: error' \
  --rule '@typescript-eslint/unbound-method: error' || true

# Cleanup
rm "$TEMP_TSCONFIG"

echo ""
echo "📝 Next steps:"
echo "1. Fix all TypeScript and ESLint errors shown above"
echo "2. Remove '$FILE' from the test file overrides in eslint.config.js"
echo "3. Run 'npm run validate' to verify all checks pass"
echo "4. Update .betterer.results by running 'npm run betterer:update'"
```

Make it executable:

```bash
chmod +x scripts/migrate-test-file.sh
```

#### 4.2 Create Batch Migration Script

Create `scripts/migrate-test-directory.sh`:

```bash
#!/bin/bash
# migrate-test-directory.sh - Migrate all test files in a directory
# Usage: ./scripts/migrate-test-directory.sh src/server/api/__tests__/

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <directory-path>"
    echo "Example: $0 src/server/api/__tests__/"
    exit 1
fi

DIR=$1

if [ ! -d "$DIR" ]; then
    echo "Error: Directory '$DIR' not found"
    exit 1
fi

echo "🔍 Finding test files in $DIR..."
TEST_FILES=$(find "$DIR" -name "*.test.ts" -o -name "*.test.tsx" | sort)

if [ -z "$TEST_FILES" ]; then
    echo "No test files found in $DIR"
    exit 0
fi

echo "Found test files:"
echo "$TEST_FILES" | nl
echo ""

# Count total errors
TOTAL_TS_ERRORS=0
TOTAL_ESLINT_ERRORS=0

for FILE in $TEST_FILES; do
    echo "Checking $FILE..."
    TS_ERRORS=$(npx tsc --noEmit --strict "$FILE" 2>&1 | grep -c "error TS" || echo "0")
    ESLINT_ERRORS=$(npx eslint "$FILE" --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | grep -c "error" || echo "0")

    TOTAL_TS_ERRORS=$((TOTAL_TS_ERRORS + TS_ERRORS))
    TOTAL_ESLINT_ERRORS=$((TOTAL_ESLINT_ERRORS + ESLINT_ERRORS))

    echo "  TypeScript errors: $TS_ERRORS"
    echo "  ESLint errors: $ESLINT_ERRORS"
done

echo ""
echo "📊 Summary for $DIR:"
echo "Total TypeScript errors: $TOTAL_TS_ERRORS"
echo "Total ESLint errors: $TOTAL_ESLINT_ERRORS"
echo ""
echo "Run './scripts/migrate-test-file.sh <file>' for detailed analysis of each file"
```

### Phase 5: Pre-commit Hook Updates

#### 5.1 Install actionlint

Add to development setup:

```bash
# macOS
brew install actionlint

# Linux/CI
curl -L https://github.com/rhysd/actionlint/releases/latest/download/actionlint_Linux_x86_64.tar.gz | tar xz -C /usr/local/bin actionlint
```

#### 5.2 Update .husky/pre-commit

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

### Phase 6: Documentation Updates

#### 6.1 Update TYPESCRIPT_MIGRATION.md

Add new sections:

```markdown
## Betterer Integration

**Status**: ✅ Implemented (2025-01-XX)

### Overview

Betterer is now integrated to track TypeScript migration progress and prevent regressions. It monitors:

- TypeScript strict mode errors
- ESLint type-safety rule violations
- Test file migration progress

### Usage

- `npm run betterer` - Update baseline after improvements
- `npm run betterer:check` - CI check (fails on regression)
- `npm run betterer:watch` - Watch mode during development

### CI Integration

Betterer runs as a separate job in our CI pipeline, preventing any PR that would increase error counts.

## Ban-ts-comment Policy

**Effective**: 2025-01-XX

### Policy

- `@ts-ignore`: ❌ Completely banned
- `@ts-expect-error`: ✅ Allowed with description (min 10 chars)
- `@ts-nocheck`: ❌ Banned
- `@ts-check`: ✅ Allowed (for JS files)

### Rationale

Using `@ts-expect-error` with descriptions ensures:

1. Suppressions are documented
2. They fail when the underlying issue is fixed
3. Technical debt is visible

## CI Pipeline Architecture

### Discrete Jobs

Our CI pipeline is split into focused jobs that run in parallel:

1. **typecheck**: TypeScript compilation
2. **lint-production**: ESLint for production code (blocking)
3. **lint-tests**: ESLint for test files (non-blocking)
4. **format**: Prettier formatting
5. **betterer**: Regression prevention
6. **test**: Jest tests with coverage
7. **security**: npm audit
8. **validate-actions**: actionlint for workflows
9. **migration-report**: PR progress updates

### Benefits

- Faster feedback through parallelization
- Clear identification of failure causes
- Non-blocking warnings for test files
- Automated progress reporting
```

#### 6.2 Create scripts/README.md

````markdown
# TypeScript Migration Scripts

This directory contains helper scripts for the TypeScript strict mode migration.

## Available Scripts

### migrate-test-file.sh

Analyzes a single test file for strict mode compatibility.

```bash
./scripts/migrate-test-file.sh src/server/api/__tests__/trpc-auth.test.ts
```
````

Shows:

- All TypeScript strict mode errors
- All ESLint type-safety violations
- Next steps for migration

### migrate-test-directory.sh

Provides overview of all test files in a directory.

```bash
./scripts/migrate-test-directory.sh src/server/api/__tests__/
```

Shows:

- List of all test files
- Error counts for each file
- Total errors in the directory

### update-typescript-stats.sh

Updates the TYPESCRIPT_MIGRATION.md file with current error counts.

```bash
./scripts/update-typescript-stats.sh
```

Automatically:

- Runs typecheck and lint
- Counts errors by type
- Updates migration tracking document
- Preserves error history

## Migration Workflow

1. Choose a test file or directory to migrate
2. Run the analysis script to see current errors
3. Fix TypeScript errors first (they often resolve ESLint issues)
4. Remove the file from ESLint test overrides
5. Run `npm run validate` to verify
6. Update Betterer baseline: `npm run betterer:update`
7. Commit changes

## Tips

- Start with files that have fewer errors
- Focus on one error type at a time
- Use proper Jest mock typing patterns (see TYPESCRIPT_MIGRATION.md)
- Ask for help if you encounter complex type issues

```

## Implementation Steps

1. **Install Betterer and dependencies**
2. **Create .betterer.ts configuration**
3. **Update package.json scripts**
4. **Update eslint.config.js with ban-ts-comment**
5. **Create migration helper scripts**
6. **Update pre-commit hook for actionlint**
7. **Run initial Betterer baseline**: `npm run betterer`
8. **Commit .betterer.results file**
9. **Replace current CI workflow with discrete jobs**
10. **Update documentation**

## Success Metrics

- No new TypeScript errors can be introduced
- Test file warnings are visible but non-blocking
- CI provides clear feedback on which checks fail
- PR comments show migration progress
- Developers have tools to migrate files incrementally
```
