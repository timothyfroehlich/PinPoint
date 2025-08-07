# Development Troubleshooting Guide

This guide covers common development issues beyond environment setup. For environment setup issues, see [docs/troubleshooting.md](../troubleshooting.md).

## TypeScript Issues

### Betterer Fails Unexpectedly

**Symptom**: `npm run betterer:check` fails but TypeScript check passes.

**Solutions**:

```bash
# 1. Clear Node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# 2. Reset Betterer baseline
rm .betterer.results
npm run betterer
git add .betterer.results

# 3. Check for configuration changes
git diff .betterer.ts tsconfig.json eslint.config.js
```

### TypeScript Errors Don't Match Betterer

**Symptom**: `npm run typecheck` shows different errors than Betterer.

**Cause**: Different TypeScript configurations or include patterns.

**Solutions**:

```bash
# Check Betterer uses correct tsconfig
cat .betterer.ts | grep typescript

# Verify include patterns match
npm run typecheck -- --listFiles | head -20
```

### ESLint Type-Aware Rules Failing

**Symptom**: ESLint can't parse TypeScript or type information.

**Solutions**:

```bash
# 1. Verify TypeScript project configuration
npx eslint --print-config src/server/api/trpc.ts

# 2. Check parserOptions in eslint.config.js
grep -A 5 "parserOptions" eslint.config.js

# 3. Regenerate TypeScript project info
npm run typecheck -- --build --force
```

## Test Issues

### Vitest Mock Type Errors

**Symptom**: Mock functions showing TypeScript errors despite correct setup.

**Common Causes**:

```typescript
// ❌ Problem: Circular type reference
const mockPrisma = {
  user: {
    findUnique: vi.fn() as MockedFunction<typeof prisma.user.findUnique>,
  },
};

// ✅ Solution: Use explicit types
const mockPrisma = {
  user: {
    findUnique: vi.fn<Promise<User | null>, [any]>(),
  },
};
```

### ExtendedPrismaClient Mocking Issues

**Symptom**: Type errors when mocking Prisma client with $accelerate.

**Solution**:

```typescript
// ✅ Complete mock structure
const mockPrisma: Partial<ExtendedPrismaClient> = {
  user: { findUnique: vi.fn() },
  $accelerate: {
    invalidate: vi.fn<Promise<void>, [string]>(),
    invalidateAll: vi.fn<Promise<void>, []>(),
  },
  $transaction: vi.fn(),
  $disconnect: vi.fn<Promise<void>, []>(),
};
```

### Test Isolation Issues

**Symptom**: Tests failing inconsistently or affecting each other.

**Solutions**:

```typescript
// Ensure proper cleanup in test setup
beforeEach(() => {
  vi.clearAllMocks();

  // Reset mock implementations to default
  mockPrisma.user!.findUnique!.mockResolvedValue(null);
  mockPrisma.organization!.findUnique!.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

## Build and Compilation Issues

### Next.js Build Failures

**Symptom**: `npm run build` fails but dev server works.

**Common Issues**:

```bash
# 1. Check for production-only type errors
npm run typecheck

# 2. Verify all imports are resolvable
npm run build 2>&1 | grep "Module not found"

# 3. Check for environment variable dependencies
grep -r "process.env" src/ --exclude-dir=node_modules
```

### ESM Module Issues

**Symptom**: Import/export errors or "require() of ES modules not supported".

**Solutions**:

```bash
# 1. Check package.json type field
grep '"type"' package.json

# 2. Verify Vitest ESM configuration
grep -A 5 "define" vitest.config.ts

# 3. Check for mixed module types
npm ls | grep -E "(superjson|@auth)"
```

## Development Workflow Issues

### Pre-commit Hooks Failing

**Symptom**: Git commits blocked by pre-commit hooks.

**Solutions**:

```bash
# 1. Run validation manually to see details
npm run validate

# 2. Check actionlint if available
which actionlint && actionlint .github/workflows/*.yml

# 3. Skip hooks temporarily (emergency only)
git commit -m "fix: emergency commit" --no-verify
```

### Database Reset Issues

**Symptom**: `npm run reset:local` fails or leaves inconsistent state.

**Solutions**:

```bash
# 1. Force reset with cleanup
rm -f prisma/dev.db*
npm run db:push

# 2. Validate database operations
npm run db:validate

# 3. Reset with fresh generation
npm run reset:local
npm run db:generate
```

### Service Dependencies Not Found

**Symptom**: TypeScript errors about missing service dependencies.

**Solutions**:

```bash
# 1. Check service factory configuration
cat src/server/services/factory.ts

# 2. Verify service exports
ls src/server/services/*.ts

# 3. Check import/export consistency
npm run typecheck -- --noEmit
```

## Performance Issues

### Slow TypeScript Checking

**Symptom**: `npm run typecheck` takes very long.

**Solutions**:

```bash
# 1. Use incremental checking
npm run typecheck -- --incremental

# 2. Filter for specific patterns
npm run typecheck | grep "routers"

# 3. Use watch mode for development
npm run typecheck -- --watch
```

### Slow ESLint Execution

**Symptom**: `npm run lint` is very slow.

**Solutions**:

```bash
# 1. Check what rules are active
npm run lint:verbose 2>&1 | head -50

# 2. Lint specific directories
npm run lint -- src/server/

# 3. Check lint output by pattern
npm run lint 2>&1 | grep "no-unsafe"
```

### Slow Vitest Tests

**Symptom**: Test suite takes very long to run.

**Solutions**:

```bash
# 1. Run tests in band (disable parallelization)
npm test -- --runInBand

# 2. Check for expensive operations in tests
npm test -- --verbose

# 3. Run specific test files
npm test -- --testPathPattern=user.test.ts
```

## Migration Workflow Issues

### Merge Conflicts in .betterer.results

**Symptom**: Git conflicts when merging branches with Betterer changes.

**Resolution**:

```bash
# 1. Take the incoming version (usually main)
git checkout --theirs .betterer.results

# 2. Verify no regressions were introduced
npm run betterer:check

# 3. If check fails, you introduced new errors
npm run typecheck | head -20
# Fix the errors, then update baseline
npm run betterer:update
```

### Betterer Baseline Drift

**Symptom**: Baseline file keeps changing without code changes.

**Causes & Solutions**:

```bash
# 1. Check for non-deterministic tests
DEBUG=betterer npm run betterer:check

# 2. Verify include/exclude patterns
cat .betterer.ts | grep -A 3 -B 3 include

# 3. Check for file system case sensitivity issues
git config core.ignorecase
```

### Migration Progress Tracking Issues

**Symptom**: Stats in TYPESCRIPT_MIGRATION.md don't match reality.

**Solutions**:

```bash
# 1. Update stats manually
./scripts/update-typescript-stats.sh

# 2. Verify script is working correctly
npm run typecheck 2>&1 | grep "error TS" | wc -l

# 3. Check git tracking of stats file
git status TYPESCRIPT_MIGRATION.md
```

## Debugging Tools

### TypeScript Diagnostics

```bash
# Detailed TypeScript output
npm run debug:typecheck

# Check specific errors by pattern
npm run typecheck | grep "user.ts"

# List all files being checked
npm run typecheck -- --listFiles
```

### ESLint Diagnostics

```bash
# Detailed ESLint output
npm run lint:verbose

# Check rule configuration
npx eslint --print-config src/server/api/trpc.ts

# Test specific rule
npx eslint --rule "@typescript-eslint/no-explicit-any" src/server/
```

### Betterer Diagnostics

```bash
# Verbose Betterer output
DEBUG=betterer npm run betterer:check

# Check specific test
npm run betterer -- --filter "typescript strict mode"

# List all tracked tests
npm run betterer -- --help
```

## Emergency Procedures

### Bypass All Checks (Emergency Only)

```bash
# Skip pre-commit hooks
git commit -m "emergency: bypass checks" --no-verify

# Skip Betterer for one commit
rm .betterer.results
git add .betterer.results
git commit -m "emergency: reset betterer baseline"
```

### Restore Known Good State

```bash
# Reset to last known good commit
git log --oneline -10
git reset --hard <good-commit-hash>

# Rebuild everything
rm -rf node_modules package-lock.json
npm install
npm run validate
```

### Quick Fixes for Common Patterns

```bash
# Fix common exactOptionalPropertyTypes issues
find src/ -name "*.ts" -type f -exec sed -i 's/: value || undefined/: value/g' {} \;

# Remove all console.log statements
find src/ -name "*.ts" -type f -exec sed -i '/console\.log/d' {} \;

# Add proper TypeScript error ignores
find src/ -name "*.test.ts" -type f -exec sed -i 's/\/\/ @ts-ignore/\/\/ @ts-expect-error - Test mock typing/g' {} \;
```

## Getting Help

### Information to Gather

Before asking for help, collect:

```bash
# System information
node --version
npm --version
git --version

# Project state
npm run typecheck 2>&1 | head -10
npm run lint 2>&1 | head -10
npm run betterer:check 2>&1

# Git state
git status --porcelain
git log --oneline -5
```

### Common Commands for Support

```bash
# Generate full diagnostic report
{
  echo "=== System Info ==="
  node --version
  npm --version
  echo "=== TypeScript Errors ==="
  npm run typecheck 2>&1 | head -20
  echo "=== ESLint Errors ==="
  npm run lint 2>&1 | head -20
  echo "=== Betterer Status ==="
  npm run betterer:check 2>&1
} > debug-report.txt
```

## Related Documentation

- **Environment Setup**: [docs/troubleshooting.md](../troubleshooting.md)
- **TypeScript Patterns**: [typescript-strictest-production.md](./typescript-strictest-production.md)
- **Testing Issues**: [docs/testing/troubleshooting.md](../testing/troubleshooting.md)
- **Migration Workflow**: [betterer-workflow.md](./betterer-workflow.md)
