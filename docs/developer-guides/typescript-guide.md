# TypeScript Complete Guide

This comprehensive guide covers PinPoint's TypeScript setup, error resolution patterns, and migration lessons learned. Use this as the single reference for all TypeScript-related development.

## 🚀 Quick Start for Agents

### Current State

- **Production Code**: 100% TypeScript strict mode compliant (`@tsconfig/strictest`)
- **Test Files**: Relaxed standards with pragmatic patterns allowed
- **Multi-Config**: Different strictness levels for different code contexts

### Essential Commands

```bash
# Check production code (must pass)
npm run typecheck

# Full validation with auto-fix
npm run validate

# Quick checks during development
npm run quick

# Update Betterer baseline after fixes
npm run betterer:update
```

### Most Common Patterns

```typescript
// Null safety with optional chaining
if (!ctx.session?.user?.id) {
  throw new Error("Not authenticated");
}
const userId = ctx.session.user.id; // Now safe

// Safe array access
const firstItem = items[0]?.name ?? "No items";

// Optional property assignment
const data: { name?: string } = {};
if (value) data.name = value;
```

## 🏗️ Multi-Config Architecture

PinPoint uses a tiered TypeScript configuration system balancing strict production standards with pragmatic testing needs:

### Configuration Files

1. **`tsconfig.base.json`** - Common settings (paths, module resolution, Next.js plugins)
2. **`tsconfig.json`** - Production code (extends base + `@tsconfig/strictest`)
3. **`tsconfig.test-utils.json`** - Test utilities (extends base + `@tsconfig/recommended`)
4. **`tsconfig.tests.json`** - Test files (extends base with relaxed settings)

### Standards by Context

#### Production Code (`src/**/*.ts` excluding tests)

- **Config**: `tsconfig.json` (strictest mode)
- **Standards**: **Zero tolerance** - all TypeScript errors must be fixed
- **ESLint**: Strict type-safety rules at error level

#### Test Utilities (`src/test/**/*.ts`)

- **Config**: `tsconfig.test-utils.json` (recommended mode)
- **Standards**: Moderate - allows practical testing patterns
- **ESLint**: Type-safety rules at warning level

#### Test Files (`**/*.test.ts`, `**/*.vitest.test.ts`)

- **Config**: `tsconfig.tests.json` (relaxed mode)
- **Standards**: Pragmatic - allows `any` types and unsafe operations for testing
- **ESLint**: Type-safety rules disabled

### Development Workflow

```bash
# Production code (must pass)
npm run typecheck

# Test utilities (warnings OK)
npx tsc --project tsconfig.test-utils.json --noEmit

# Test files (very permissive)
npx tsc --project tsconfig.tests.json --noEmit

# Agent commands (recommended)
npm run quick        # Quick validation with auto-fix
npm run validate     # Pre-commit validation
npm run pre-commit # Pre-PR validation
```

## 🔧 Error Categories and Solutions

### 1. exactOptionalPropertyTypes Violations

**Error**: `Type 'undefined' is not assignable to type 'string'` in optional properties.

**Root Cause**: `exactOptionalPropertyTypes: true` makes optional properties stricter - they can be missing but not explicitly `undefined`.

#### Solutions

**Pattern 1: Conditional Assignment**

```typescript
// ❌ Bad
const data: { name?: string } = { name: value || undefined };

// ✅ Good
const data: { name?: string } = {};
if (value) data.name = value;
```

**Pattern 2: Object Spread with Filter**

```typescript
// ❌ Bad
const updateData = {
  name: newName || undefined,
  email: newEmail || undefined,
};

// ✅ Good
const updateData = {
  ...otherFields,
  ...(newName && { name: newName }),
  ...(newEmail && { email: newEmail }),
};
```

**Pattern 3: Conditional Object Creation**

```typescript
// ❌ Bad
const config: Config = {
  apiKey: process.env.API_KEY || undefined,
  timeout: timeout || undefined,
};

// ✅ Good
const config: Config = {
  ...baseConfig,
  ...(process.env.API_KEY && { apiKey: process.env.API_KEY }),
  ...(timeout && { timeout }),
};
```

### 2. strictNullChecks Violations

**Error**: `Object is possibly 'null' or 'undefined'`

#### Solutions

**Pattern 1: Early Return with Guards**

```typescript
// ❌ Bad
function processUser(ctx: Context) {
  const userId = ctx.session.user.id; // Error: session possibly null
  return userService.get(userId);
}

// ✅ Good
function processUser(ctx: Context) {
  if (!ctx.session?.user?.id) {
    throw new Error("User not authenticated");
  }
  const userId = ctx.session.user.id; // Now safely typed
  return userService.get(userId);
}
```

**Pattern 2: Optional Chaining with Nullish Coalescing**

```typescript
// ❌ Bad
const userName = user.profile.name; // Error: profile possibly null

// ✅ Good
const userName = user.profile?.name ?? "Anonymous";
```

**Pattern 3: Type Guards**

```typescript
function isAuthenticated(ctx: Context): ctx is Context & {
  session: { user: { id: string } };
} {
  return !!ctx.session?.user?.id;
}

// Usage
if (isAuthenticated(ctx)) {
  const userId = ctx.session.user.id; // Safely typed
}
```

### 3. noUncheckedIndexedAccess Violations

**Error**: Array or object access without bounds checking.

#### Solutions

**Pattern 1: Optional Chaining**

```typescript
// ❌ Bad
const firstItem = items[0].name; // Error: possibly undefined

// ✅ Good
const firstItem = items[0]?.name ?? "No items";
```

**Pattern 2: Array.at() Method**

```typescript
// ❌ Bad
const lastItem = items[items.length - 1].name;

// ✅ Good
const lastItem = items.at(-1)?.name ?? "No items";
```

**Pattern 3: Length Check**

```typescript
// ❌ Bad
function processFirstItem(items: Item[]) {
  return items[0].process(); // Error: possibly undefined
}

// ✅ Good
function processFirstItem(items: Item[]) {
  if (items.length === 0) {
    throw new Error("No items to process");
  }
  return items[0].process(); // Safe after length check
}
```

### 4. Prisma Type Issues

**Error**: ExtendedPrismaClient type mismatches, especially with $accelerate.

#### Solutions

**Pattern 1: Proper Mock Structure**

```typescript
// ❌ Bad
const mockPrisma = {
  user: { findUnique: jest.fn() },
} as ExtendedPrismaClient;

// ✅ Good
const mockPrisma = {
  user: {
    findUnique: jest.fn<Promise<User | null>, [any]>(),
    create: jest.fn<Promise<User>, [any]>(),
  },
  $accelerate: {
    invalidate: jest.fn<Promise<void>, [string]>(),
    invalidateAll: jest.fn<Promise<void>, []>(),
  },
} satisfies Partial<ExtendedPrismaClient>;
```

**Pattern 2: Typed Query Results**

```typescript
// ❌ Bad
const user = await prisma.user.findUnique({ where: { id } });
return user.name; // Error: user possibly null

// ✅ Good
const user = await prisma.user.findUnique({ where: { id } });
if (!user) {
  throw new Error("User not found");
}
return user.name; // Safe after null check
```

### 5. ESLint Type-Safety Rule Violations

#### @typescript-eslint/no-unsafe-assignment

```typescript
// ❌ Bad
const data: any = await apiCall();
const name = data.user.name; // Unsafe assignment

// ✅ Good
const response: unknown = await apiCall();
if (isValidResponse(response)) {
  const name = response.user.name; // Safe after validation
}
```

#### @typescript-eslint/no-unsafe-member-access

```typescript
// ❌ Bad
function processResponse(response: any) {
  return response.data.items; // Unsafe member access
}

// ✅ Good
interface ApiResponse {
  data: { items: Item[] };
}

function processResponse(response: ApiResponse) {
  return response.data.items; // Safe with proper typing
}
```

## 🧪 Test File Patterns

### Configuration-Specific Patterns

#### Production Code Patterns

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

#### Test Utility Patterns

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

#### Test File Patterns

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

### Jest Mock Typing

```typescript
// ❌ Bad
const mockUserService = {
  get: jest.fn(),
  create: jest.fn(),
} as any;

// ✅ Good
const mockUserService: jest.Mocked<UserService> = {
  get: jest.fn<Promise<User>, [string]>(),
  create: jest.fn<Promise<User>, [CreateUserData]>(),
};
```

### Mock Implementation with Proper Types

```typescript
// ❌ Bad
mockPrisma.user.findUnique.mockImplementation((args: any) => {
  return Promise.resolve({ id: "1", name: "Test" } as any);
});

// ✅ Good
mockPrisma.user.findUnique.mockImplementation(async (args) => {
  return args.where.id === "1"
    ? { id: "1", name: "Test", email: "test@example.com" }
    : null;
});
```

## ⚠️ Critical Lessons from Real Migrations

### Infrastructure Dependencies: The Cascade Effect

**Lesson**: Fixing TypeScript errors in shared infrastructure can break more files than it fixes.

**Real Example**: Changing `mockContext.ts` from `DeepMockProxy<ExtendedPrismaClient>` to manual mocks to fix AcceleratePromise errors:

- ✅ Fixed: 6 AcceleratePromise errors
- ❌ Broke: 40+ dependent test files
- 📈 **Net result**: 72 → 108 errors (+36 errors)

**Solution Strategy**:

1. **Map dependencies first**: `grep -r "mockContext" src/` before changing
2. **Incremental fixes**: Fix one file at a time, not infrastructure
3. **Interface preservation**: Keep existing interfaces, add compatibility layers
4. **Error tracking**: Monitor total error count as primary success metric

### The Right Order: Dependencies First

**Lesson**: Fix in dependency order to avoid cascade failures.

**Recommended Order**:

```
1. Fix shared types and interfaces
2. Fix utility functions and helpers
3. Fix mock infrastructure (carefully!)
4. Fix individual test files
5. Fix router/API files
6. Fix component files
```

**Wrong Order Example**:

```typescript
// ❌ Fixed individual files first
// Fixed: trpc-auth.test.ts (24 errors)
// Then changed: mockContext.ts
// Result: trpc-auth.test.ts broke again + 20 new errors
```

**Right Order Example**:

```typescript
// ✅ Fixed infrastructure first (incrementally)
// Fixed: mockContext.ts AcceleratePromise patterns
// Then fixed: individual test files using new patterns
// Result: Stable progress, no regressions
```

### Prisma Accelerate: The Hidden Type Trap

**Lesson**: Prisma + Accelerate changes method signatures in non-obvious ways.

**The Problem**:

```typescript
// Before Accelerate
mockDb.user.findFirst.mockResolvedValue(user); // Works

// After Accelerate
mockDb.user.findFirst.mockResolvedValue(user);
// Error: Type 'User' is not assignable to type 'AcceleratePromise<User | null>'
```

**Root Cause**: `@prisma/extension-accelerate` wraps all Prisma methods in `AcceleratePromise<T>` which has additional properties (`withAccelerateInfo`, `[Symbol.toStringTag]`, etc.).

**Working Solutions**:

```typescript
// ✅ Solution 1: Promise wrapper + type assertion
mockDb.user.findFirst.mockResolvedValue(Promise.resolve(user) as any);

// ✅ Solution 2: Use mockImplementation
mockDb.user.findFirst.mockImplementation(async () => user);

// ✅ Solution 3: Create AcceleratePromise-compatible mock
const createAcceleratePromise = <T>(value: T): AcceleratePromise<T> => {
  const promise = Promise.resolve(value);
  return Object.assign(promise, {
    withAccelerateInfo: promise,
    [Symbol.toStringTag]: "Promise",
  }) as AcceleratePromise<T>;
};
```

### Error Count as Primary Metric

**Lesson**: Total TypeScript error count is the most reliable progress indicator.

**Monitoring Commands**:

```bash
# Primary metric
npm run typecheck 2>&1 | grep -c "error TS"

# Progress breakdown
npm run typecheck 2>&1 | grep "error TS" | cut -d'(' -f1 | sort | uniq -c | sort -nr

# Continuous monitoring
watch 'npm run typecheck 2>&1 | grep -c "error TS"'
```

**Decision Rules**:

- ✅ Error count decreases: Continue current approach
- ⚠️ Error count stable: Change approach
- ❌ Error count increases >20%: Rollback immediately

**Success Pattern**:

```
Starting: 72 errors
After fix 1: 68 errors (-4) ✅
After fix 2: 64 errors (-4) ✅
After fix 3: 45 errors (-19) ✅
After infrastructure change: 108 errors (+63) ❌ ROLLBACK!
After rollback: 64 errors (back to known good) ✅
After targeted fix: 52 errors (-12) ✅
```

### Session Context Types: The tRPC Trap

**Lesson**: tRPC context typing is stricter than it appears.

**The Problem**:

```typescript
// Looks correct but fails
const caller = appRouter.createCaller(mockContext);
// Error: Session is not assignable to parameter of type 'never'
```

**Root Cause**: tRPC's `createCaller` expects exact context types, not compatible mock types.

**Solution**:

```typescript
// ✅ Explicit type assertion
import type { TRPCContext } from "~/server/api/trpc.base";
const caller = appRouter.createCaller(mockContext as TRPCContext);

// ✅ Better: Create proper context factory
function createTRPCMockContext(
  overrides: Partial<TRPCContext> = {},
): TRPCContext {
  return {
    db: mockDeep<ExtendedPrismaClient>(),
    session: null,
    organization: null,
    services: mockServiceFactory(),
    headers: new Headers(),
    ...overrides,
  };
}
```

## 🛠️ Advanced Patterns

### Conditional Type Utilities

```typescript
// Helper for optional property assignment
function assignIfExists<T extends Record<string, unknown>>(
  obj: T,
  key: keyof T,
  value: T[keyof T] | undefined,
): T {
  if (value !== undefined) {
    obj[key] = value;
  }
  return obj;
}

// Usage
let data: { name?: string } = {};
data = assignIfExists(data, "name", maybeName);
```

### Safe Array Operations

```typescript
// Safe first/last access
function safeFirst<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[0] : undefined;
}

function safeLast<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[arr.length - 1] : undefined;
}
```

### Type-Safe Environment Variables

```typescript
// ❌ Bad
const config = {
  apiKey: process.env.API_KEY || undefined,
  port: Number(process.env.PORT) || undefined,
};

// ✅ Good
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getOptionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

const config = {
  apiKey: getRequiredEnv("API_KEY"),
  ...(process.env.PORT && { port: Number(process.env.PORT) }),
};
```

## 📋 Migration Workflow

### 1. Analyze Errors

```bash
# Check specific file
./scripts/migrate-test-file.sh src/path/to/file.ts

# Check directory
./scripts/migrate-test-directory.sh src/path/to/dir/
```

### 2. Fix by Error Type

1. **Start with TypeScript errors** - they often resolve ESLint issues
2. **Fix exactOptionalPropertyTypes** - use conditional assignment
3. **Add null checks** - use optional chaining and guards
4. **Remove any usage** - find real types
5. **Fix array access** - add bounds checking

### 3. Validate Changes

```bash
# Quick validation
npm run validate

# Detailed output
npm run debug:typecheck
```

### 4. Update Baselines

```bash
# Update Betterer baseline after fixes
npm run betterer:update

# Update migration stats
./scripts/update-typescript-stats.sh
```

## 🔍 Troubleshooting

### Common Migration Issues

#### Issue 1: Test Files Breaking Production Builds

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

#### Issue 2: ESLint Configuration Conflicts

**Problem**: ESLint trying to parse files with wrong TypeScript config.

**Solution**: Add config files to global ignores:

```javascript
// eslint.config.js
{
  ignores: ["vitest.config.ts", "jest.config.js", "playwright.config.ts"];
}
```

#### Issue 3: Import Errors Between Configs

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

### Diagnostic Commands

#### Configuration Testing

```bash
# Test production config
npx tsc --project tsconfig.json --noEmit

# Test utilities config
npx tsc --project tsconfig.test-utils.json --noEmit

# Test files config
npx tsc --project tsconfig.tests.json --noEmit
```

#### Error Analysis

```bash
# Count errors by config
npm run typecheck 2>&1 | grep -c "error TS"
npx tsc --project tsconfig.test-utils.json --noEmit 2>&1 | grep -c "error TS"
npx tsc --project tsconfig.tests.json --noEmit 2>&1 | grep -c "error TS"
```

#### Migration Validation

```bash
# Verify multi-config setup
npm run quick

# Full validation
npm run validate
```

## 📚 Tools and Commands Reference

### Development Scripts

- `npm run typecheck` - Check TypeScript errors (production code only)
- `npm run lint` - Check ESLint warnings
- `npm run validate` - Full validation with auto-fix
- `npm run debug:typecheck` - Detailed TypeScript output

### Migration Scripts

- `./scripts/migrate-test-file.sh <file>` - Analyze single file
- `./scripts/migrate-test-directory.sh <dir>` - Analyze directory
- `./scripts/update-typescript-stats.sh` - Update progress tracking

### Betterer Commands

- `npm run betterer` - Run Betterer checks
- `npm run betterer:update` - Update baseline after fixes
- `npm run betterer:check` - CI-style check

### Agent Validation Protocol

- `npm run quick` - Development checks + auto-fix (after code changes)
- `npm run validate` - Pre-commit validation + auto-fix (MUST PASS)
- `npm run pre-commit` - Pre-PR validation (MUST PASS)

## 🎯 Best Practices

### For New Code

- Never use `any` type in production code
- Enable all strict checks from the start
- Write tests with appropriate types for their context (relaxed OK)

### For Migration

- Fix errors file by file, not globally
- Run `npm run quick` after changes
- Keep PR sizes manageable
- Document type utilities and patterns
- Monitor error count as primary success metric

### For Agents

- Use error count as primary progress indicator
- Always check multi-config context when fixing TypeScript issues
- Preserve existing interfaces when fixing infrastructure
- Map dependencies before changing shared code

## 🔗 Related Documentation

- **Quick Reference**: [CLAUDE.md Multi-Config Strategy](../../CLAUDE.md#multi-config-typescript-strategy)
- **Testing Patterns**: [docs/testing/configuration.md](../testing/configuration.md)
- **ESLint Setup**: [docs/developer-guides/common-errors.md](./common-errors.md)
- **Betterer Workflow**: [docs/developer-guides/betterer-workflow.md](./betterer-workflow.md)

This guide represents the complete knowledge from the TypeScript migration and should be the single source of truth for all TypeScript development in PinPoint.
