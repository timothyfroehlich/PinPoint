# TypeScript Multi-Config Guide

This guide covers PinPoint's multi-config TypeScript setup, providing different strictness levels for production code, test utilities, and test files.

## Quick Start

For immediate patterns, see the [Multi-Config TypeScript Strategy in CLAUDE.md](../../CLAUDE.md#multi-config-typescript-strategy).

## Configuration Overview

PinPoint uses a tiered configuration system to balance strict production standards with pragmatic testing needs:

### 1. `tsconfig.base.json` - Common Foundation

- Shared compiler options
- Path mappings (`~/*` → `./src/*`)
- Next.js plugins and ESM settings
- Module resolution and target configuration

### 2. `tsconfig.json` - Production Code (Strictest)

- **Extends**: `tsconfig.base.json` + `@tsconfig/strictest`
- **Applies to**: `src/**/*.ts` excluding tests
- **Standards**: Zero tolerance for TypeScript errors
- **ESLint**: Error-level type-safety rules

### 3. `tsconfig.test-utils.json` - Test Utilities (Recommended)

- **Extends**: `tsconfig.base.json` + `@tsconfig/recommended`
- **Applies to**: `src/test/**/*.ts`
- **Standards**: Moderate - practical testing patterns allowed
- **ESLint**: Warning-level type-safety rules

### 4. `tsconfig.tests.json` - Test Files (Relaxed)

- **Extends**: `tsconfig.base.json` only
- **Applies to**: `**/*.test.ts`, `**/*.vitest.test.ts`
- **Standards**: Pragmatic - `any` types and unsafe operations allowed
- **ESLint**: Type-safety rules disabled

## Development Workflow

### Checking Different Contexts

```bash
# Production code (must pass)
npm run typecheck

# Test utilities (warnings OK)
npx tsc --project tsconfig.test-utils.json --noEmit

# Test files (very permissive)
npx tsc --project tsconfig.tests.json --noEmit
```

### Agent Commands (Recommended)

```bash
# Quick validation with auto-fix
npm run quick:agent

# Pre-commit validation
npm run validate:agent

# Full pre-PR validation
npm run validate:full:agent
```

## Migration from Single Config

### Step 1: Update Existing Code

**Before (Single Config)**:

```typescript
// Had to fix all test files to strictest standards
const mockUser: User = {
  id: "1",
  name: value ?? undefined, // Error in strictest
  email: data?.email ?? undefined, // Error in strictest
};
```

**After (Multi-Config)**:

```typescript
// Production code: Still strict
const user: User = {
  id: "1",
  ...(value && { name: value }),
  ...(data?.email && { email: data.email }),
};

// Test files: Now pragmatic
const mockUser: any = {
  id: "1",
  name: value ?? undefined, // OK in tests
  email: data?.email ?? undefined, // OK in tests
};
```

### Step 2: ESLint Pattern-Based Rules

ESLint now applies different rules based on file patterns:

```javascript
// Production code: Strict rules
"@typescript-eslint/no-explicit-any": "error",

// Test utilities: Moderate rules
files: ["src/test/**/*.ts"],
"@typescript-eslint/no-explicit-any": "warn",

// Test files: Relaxed rules
files: ["**/*.test.ts", "**/*.vitest.test.ts"],
"@typescript-eslint/no-explicit-any": "off",
```

## Configuration-Specific Patterns

### Production Code Patterns

Must follow strictest TypeScript standards:

```typescript
// ✅ Production: Proper null checks
if (!ctx.session?.user?.id) {
  throw new Error("Not authenticated");
}
const userId = ctx.session.user.id;

// ✅ Production: Safe array access
const firstItem = items[0]?.name ?? "No items";

// ✅ Production: Conditional assignment
const data: { name?: string } = {};
if (value) data.name = value;
```

### Test Utility Patterns

Moderate standards for reusable test code:

```typescript
// ✅ Test Utils: Some flexibility allowed
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "1",
    name: "Test User",
    email: "test@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides, // Partial spread OK
  };
}

// ⚠️ Test Utils: Warnings for any usage (but not blocking)
const mockService: any = jest.fn(); // Warning but allowed
```

### Test File Patterns

Pragmatic patterns for effective testing:

```typescript
// ✅ Tests: Direct patterns allowed
const mockUser: any = { id: "1", name: "Test" };
const mockSession = { user: mockUser };
const userId = mockSession.user.id; // Direct access OK

// ✅ Tests: Flexible mocking
jest.mock("~/lib/service", () => ({
  getUserData: jest.fn().mockReturnValue({ data: "test" }),
}));

// ✅ Tests: Type assertions for mocks
const mockFunction = jest.fn() as jest.MockedFunction<typeof realFunction>;
```

## Common Migration Issues

### Issue 1: Test Files Breaking Production Builds

**Problem**: Test files with relaxed patterns break when included in production config.

**Solution**: Proper exclusion in `tsconfig.json`:

```json
{
  "exclude": [
    "src/test/**/*",
    "**/__tests__/**/*",
    "**/*.test.*",
    "**/*.spec.*",
    "**/*.vitest.test.*"
  ]
}
```

### Issue 2: ESLint Configuration Conflicts

**Problem**: ESLint trying to parse files with wrong TypeScript config.

**Solution**: Add config files to global ignores:

```javascript
// eslint.config.js
{
  ignores: ["vitest.config.ts", "jest.config.js", "playwright.config.ts"];
}
```

### Issue 3: Import Errors Between Configs

**Problem**: Test files importing from production code with different strictness.

**Solution**: Use base config for shared path mappings:

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["./src/*"]
    }
  }
}
```

## Vitest Configuration

Vitest projects reference appropriate configs:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          typecheck: {
            tsconfig: "./tsconfig.tests.json", // Relaxed for tests
          },
        },
      },
    ],
  },
});
```

## CI/CD Integration

Simplified workflow using multi-config:

```yaml
# .github/workflows/ci.yml
- name: TypeScript Check (Multi-config)
  run: |
    # Production code (strictest) - must pass
    npm run typecheck

    # Test utilities (recommended) - warnings only
    npx tsc --project tsconfig.test-utils.json --noEmit || true

    # Test files (relaxed) - very permissive
    npx tsc --project tsconfig.tests.json --noEmit || true
```

## Troubleshooting

### Config Not Applied

**Symptoms**: Files not picking up expected TypeScript strictness.

**Check**:

1. File matches include/exclude patterns
2. ESLint `parserOptions.project` references correct configs
3. IDE using correct config (restart TypeScript service)

### Import Resolution Issues

**Symptoms**: `~/*` imports not resolving.

**Solution**: Ensure all configs extend `tsconfig.base.json` for shared paths.

### Test Framework Conflicts

**Symptoms**: Jest/Vitest import errors or type conflicts.

**Solution**: Check `typecheck.tsconfig` in test configs points to relaxed config.

## Tools and Commands

### Configuration Testing

```bash
# Test production config
npx tsc --project tsconfig.json --noEmit

# Test utilities config
npx tsc --project tsconfig.test-utils.json --noEmit

# Test files config
npx tsc --project tsconfig.tests.json --noEmit
```

### Error Analysis

```bash
# Count errors by config
npm run typecheck 2>&1 | grep -c "error TS"
npx tsc --project tsconfig.test-utils.json --noEmit 2>&1 | grep -c "error TS"
npx tsc --project tsconfig.tests.json --noEmit 2>&1 | grep -c "error TS"
```

### Migration Validation

```bash
# Verify multi-config setup
npm run quick:agent

# Full validation
npm run validate:agent
```

## Benefits of Multi-Config Approach

### Development Experience

- **Production code**: Maintains highest quality standards
- **Test utilities**: Allows practical patterns while maintaining some safety
- **Test files**: Enables pragmatic testing without TypeScript friction

### CI/CD Benefits

- **Clear separation**: Production errors block builds, test issues don't
- **Focused fixes**: Address production issues first, test issues separately
- **Gradual migration**: Can improve test code incrementally

### Maintenance Benefits

- **Reduced cognitive load**: Different expectations for different code types
- **Faster testing**: Less time fixing TypeScript in tests, more time testing logic
- **Better coverage**: Easier to write comprehensive tests without strict type barriers

## Related Documentation

- **Quick Reference**: [CLAUDE.md Multi-Config Strategy](../../CLAUDE.md#multi-config-typescript-strategy)
- **Testing Patterns**: [docs/testing/configuration.md](../testing/configuration.md)
- **ESLint Setup**: [docs/developer-guides/common-errors.md](./common-errors.md)
- **Migration Status**: [TYPESCRIPT_MIGRATION.md](../../TYPESCRIPT_MIGRATION.md)
