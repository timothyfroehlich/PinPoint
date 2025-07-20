# TypeScript Strictest Mode Guide

This guide provides comprehensive solutions for resolving TypeScript errors and ESLint violations when working with `@tsconfig/strictest` configuration.

## Quick Start

For immediate help with common patterns, see the [TypeScript Strictest Mode Guidelines in CLAUDE.md](../../CLAUDE.md#typescript-strictest-mode-guidelines).

## Error Categories and Solutions

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

### 4. Type Assertion Violations

**Error**: ESLint warnings about unsafe type assertions.

#### Solutions

**Pattern 1: Proper Generic Functions**

```typescript
// ❌ Bad
const mockFn = jest.fn() as jest.Mock<any>;

// ✅ Good
const mockFn = jest.fn<UserResponse, [string]>();
```

**Pattern 2: Type Guards Instead of Assertions**

```typescript
// ❌ Bad
const data = response as ApiResponse;

// ✅ Good
function isApiResponse(data: unknown): data is ApiResponse {
  return typeof data === "object" && data !== null && "status" in data;
}

if (isApiResponse(response)) {
  // response is now properly typed
}
```

**Pattern 3: Generic Constraints**

```typescript
// ❌ Bad
function processData<T>(data: T): ProcessedData {
  return (data as ProcessedData).process();
}

// ✅ Good
function processData<T extends Processable>(data: T): ProcessedData {
  return data.process(); // Safe because of constraint
}
```

### 5. Prisma Type Issues

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

### 6. ESLint Type-Safety Rule Violations

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

#### @typescript-eslint/no-unsafe-call

```typescript
// ❌ Bad
const result = (someFunction as any)(param); // Unsafe call

// ✅ Good
const result = (someFunction as (param: ParamType) => ReturnType)(param);
// Better: Find the real type instead of casting
```

## Common Test File Patterns

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

### Type Guards for Test Data

```typescript
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "1",
    name: "Test User",
    email: "test@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

## Migration Workflow

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
npm run validate:agent

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

## Advanced Patterns

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

## Tools and Commands

### Development Scripts

- `npm run typecheck` - Check TypeScript errors
- `npm run lint` - Check ESLint warnings
- `npm run validate:agent` - Full validation
- `npm run debug:typecheck` - Detailed TypeScript output

### Migration Scripts

- `./scripts/migrate-test-file.sh <file>` - Analyze single file
- `./scripts/migrate-test-directory.sh <dir>` - Analyze directory
- `./scripts/update-typescript-stats.sh` - Update progress tracking

### Betterer Commands

- `npm run betterer` - Run Betterer checks
- `npm run betterer:update` - Update baseline after fixes
- `npm run betterer:check` - CI-style check

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

## Related Documentation

- **Quick Reference**: [CLAUDE.md TypeScript Guidelines](../../CLAUDE.md#typescript-strictest-mode-guidelines)
- **Migration Progress**: [TYPESCRIPT_MIGRATION.md](../../TYPESCRIPT_MIGRATION.md)
- **Script Documentation**: [scripts/README.md](../../scripts/README.md)
- **Betterer Workflow**: [betterer-workflow.md](./betterer-workflow.md)
- **Testing Patterns**: [testing-patterns.md](./testing-patterns.md)
