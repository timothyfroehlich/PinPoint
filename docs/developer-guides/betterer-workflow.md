# Betterer Workflow Guide

This guide covers using Betterer for incremental TypeScript migration and regression prevention in PinPoint.

## Quick Reference

For daily Betterer commands, see [CLAUDE.md Development Workflow](../../CLAUDE.md#development-workflow). This guide covers comprehensive workflow patterns.

## What is Betterer?

Betterer is a test runner that helps make incremental improvements to your code. It takes snapshots of current issues (TypeScript errors, ESLint violations) and ensures they only get better over time, never worse.

### How It Works

1. **Baseline Creation**: Takes initial snapshot of all errors
2. **Regression Prevention**: Blocks new errors from being introduced
3. **Progress Tracking**: Celebrates improvements when errors are fixed
4. **Team Coordination**: Prevents conflicts during large migrations

## Daily Workflow

### 1. Before Starting Work

```bash
# Check current status
npm run betterer:check

# Should see: "✅ 5 tests got checked. 0 tests got better. 0 tests got worse."
```

### 2. During Development

```bash
# Watch mode - shows impact of changes in real-time
npm run betterer:watch

# Quick check after making changes
npm run betterer:check
```

### 3. After Fixing Errors

```bash
# Update baseline to lock in improvements
npm run betterer:update

# Commit the updated baseline
git add .betterer.results
git commit -m "fix(typescript): resolve errors in user.service.ts"
```

### 4. Before Pushing

```bash
# Final check to ensure no regressions
npm run betterer:check

# Should pass - if it fails, you've introduced new errors
```

## Understanding Betterer Output

### Success (No Changes)

```
✅ 5 tests got checked. 0 tests got better. 0 tests got worse.
```

All good - no new errors, no fixes detected.

### Improvement Detected

```
✅ 5 tests got checked. 1 test got better. 0 tests got worse.

typescript strict mode:
  - 82 errors → 78 errors (4 fewer)

Don't forget to run `npm run betterer:update` to save improvements!
```

### Regression Detected ❌

```
❌ 5 tests got checked. 0 tests got better. 1 test got worse.

typescript strict mode:
  - 82 errors → 86 errors (4 more)

Files with new errors:
  - src/server/api/routers/user.ts:15:8 - Object is possibly 'null'
  - src/server/api/routers/user.ts:22:12 - Property 'name' does not exist
```

## What Betterer Tracks

Our `.betterer.ts` configuration monitors:

### 1. TypeScript Strict Mode

```typescript
'typescript strict mode': () =>
  typescript('./tsconfig.json', {
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
  }).include('./src/**/*.{ts,tsx}')
```

**Tracks**: All TypeScript compilation errors in strict mode.

### 2. Production Code Quality

```typescript
'no explicit any (production)': () =>
  eslint({ '@typescript-eslint/no-explicit-any': 'error' })
    .include('./src/**/*.{ts,tsx}')
    .exclude('./src/**/*.test.{ts,tsx}')
```

**Tracks**: Usage of `any` type in production code.

### 3. Type Safety Rules

```typescript
'no unsafe operations (production)': () =>
  eslint({
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
  })
```

**Tracks**: Type-unsafe operations in production code.

### 4. Test Code Progress

```typescript
'no explicit any (tests)': () =>
  eslint({ '@typescript-eslint/no-explicit-any': 'error' })
    .include('./src/**/*.test.{ts,tsx}')
```

**Tracks**: `any` usage in test files (separate from production).

## Migration Workflows

### Workflow 1: Fixing Individual Files

**Best for**: Focused improvements, specific bug fixes.

```bash
# 1. Analyze a specific file
./scripts/migrate-test-file.sh src/server/api/routers/user.ts

# 2. Fix errors shown in the analysis
# ... make your changes ...

# 3. Verify improvements
npm run betterer:check

# 4. Save improvements
npm run betterer:update

# 5. Commit
git add .betterer.results src/server/api/routers/user.ts
git commit -m "fix(typescript): resolve 3 errors in user router"
```

### Workflow 2: Directory-Based Migration

**Best for**: Systematic cleanup, team coordination.

```bash
# 1. Analyze directory
./scripts/migrate-test-directory.sh src/server/api/routers/

# 2. Pick file with fewest errors
./scripts/migrate-test-file.sh src/server/api/routers/organization.ts

# 3. Fix → Check → Update → Commit (repeat for each file)
```

### Workflow 3: Error Type Focus

**Best for**: Learning patterns, batch improvements.

```bash
# 1. Find all files with specific error type
npm run typecheck | grep "exactOptionalPropertyTypes"

# 2. Fix all instances of this error type across files
# 3. Update baseline once
npm run betterer:update

# 4. Commit all related fixes together
git add .betterer.results
git commit -m "fix(typescript): resolve exactOptionalPropertyTypes violations"
```

## Team Coordination

### Branch Strategy

**Feature Branches**:

```bash
# Start feature branch
git checkout -b feature/user-profiles

# Work normally - Betterer prevents regressions
# ... make changes ...

# Before merging, ensure no regressions
npm run betterer:check
```

**Migration Branches**:

```bash
# Dedicated migration work
git checkout -b fix/typescript-errors-batch-3

# Focus on error reduction
./scripts/migrate-test-directory.sh src/server/services/

# Update baseline frequently
npm run betterer:update

# Merge when significant progress made
```

### Handling Conflicts

**If Someone Else Fixed Errors**:

```bash
# After pulling main
git checkout main
git pull origin main

# Your branch now has stale baseline
git checkout feature/my-feature
git rebase main

# Baseline conflicts in .betterer.results
# Resolution: Use incoming version (main)
git checkout --theirs .betterer.results

# Verify your changes didn't introduce regressions
npm run betterer:check

# If check passes, continue
# If check fails, you introduced new errors - fix them
```

## Advanced Usage

### Custom Checks

Add project-specific rules to `.betterer.ts`:

```typescript
// Track TODO comments
'no todo comments': () =>
  regexp(/TODO:/i).include('./src/**/*.{ts,tsx}'),

// Track console.log usage
'no console.log in production': () =>
  regexp(/console\.log/i)
    .include('./src/**/*.{ts,tsx}')
    .exclude('./src/**/*.test.{ts,tsx}'),

// Track specific deprecated patterns
'no legacy api usage': () =>
  regexp(/legacyApiCall/i).include('./src/**/*.{ts,tsx}'),
```

### Ignoring Files Temporarily

```typescript
// Exclude problematic files temporarily
'typescript strict mode': () =>
  typescript('./tsconfig.json', { strict: true })
    .include('./src/**/*.{ts,tsx}')
    .exclude('./src/legacy/**/*') // Exclude legacy code
    .exclude('./src/external-lib.d.ts') // Exclude type definitions
```

### Performance Optimization

For large codebases:

```typescript
// Combine related ESLint rules for better performance
'typescript type safety': () =>
  eslint({
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    // ... all type rules together
  }).include('./src/**/*.{ts,tsx}')
```

## CI Integration

### GitHub Actions Setup

Betterer runs automatically in CI:

```yaml
# .github/workflows/ci.yml
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
      run: npm run betterer:check
```

### Understanding CI Failures

**CI fails with regression**:

1. Someone introduced new errors
2. Check the CI logs for specific files/errors
3. Fix the errors or coordinate with the author

**CI fails after merging**:

1. Baseline may be out of sync
2. Update baseline: `npm run betterer:update`
3. Commit updated baseline

## Troubleshooting

### Common Issues

**"Cannot find module" errors**:

```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install
```

**"Results file out of sync"**:

```bash
# Reset to current state
rm .betterer.results
npm run betterer
git add .betterer.results
```

**"Too many errors to display"**:

```bash
# Limit output in .betterer.ts
'typescript strict mode': () =>
  typescript('./tsconfig.json', { strict: true })
    .include('./src/**/*.{ts,tsx}')
    .limit(50) // Show only first 50 errors
```

### Debug Mode

```bash
# Verbose Betterer output
DEBUG=betterer npm run betterer:check

# Check specific test
npm run betterer -- --filter "typescript strict mode"
```

## Best Practices

### 1. Commit Frequency

- Update baseline after each meaningful fix
- Don't batch too many fixes in one commit
- Keep baseline changes separate from feature changes

### 2. Error Fixing Strategy

- Start with files that have fewest errors
- Focus on one error type at a time
- Fix TypeScript errors before ESLint errors (they often cascade)

### 3. Team Communication

- Coordinate migration work to avoid conflicts
- Use dedicated migration branches for large efforts
- Communicate baseline updates in team channels

### 4. Integration with Features

- Always run `betterer:check` before committing
- Don't let feature work introduce new type errors
- Use migration time for learning new patterns

## Commands Summary

```bash
# Daily usage
npm run betterer:check        # Check for regressions
npm run betterer:update       # Save improvements
npm run betterer:watch        # Watch mode

# Analysis
./scripts/migrate-test-file.sh <file>     # Analyze single file
./scripts/migrate-test-directory.sh <dir> # Analyze directory

# Advanced
npm run betterer -- --help               # Show all options
npm run betterer -- --filter "test name" # Run specific test
DEBUG=betterer npm run betterer:check     # Debug mode
```

## Related Documentation

- **Daily Usage**: [CLAUDE.md Development Workflow](../../CLAUDE.md#development-workflow)
- **Error Patterns**: [typescript-strictest.md](./typescript-strictest.md)
- **Migration Scripts**: [scripts/README.md](../../scripts/README.md)
- **Project Status**: [TYPESCRIPT_MIGRATION.md](../../TYPESCRIPT_MIGRATION.md)
