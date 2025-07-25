# TypeScript Base Standards Guide

**Status**: ✅ **Active** - Foundation patterns for all PinPoint code  
**Audience**: All developers, test utility authors  
**Config**: Based on `@tsconfig/recommended` with PinPoint adaptations

---

## Overview

This guide covers **recommended-level TypeScript patterns** that work safely across most contexts in PinPoint. These patterns form the foundation for both test utilities and serve as stepping stones toward production-level strictest patterns.

> **Note**: For production code, see [TypeScript Strictest Production Guide](./typescript-strictest-production.md) for additional requirements.

---

## Core Principles

### 1. Explicit Typing

Always prefer explicit types over inference when clarity matters:

```typescript
// ✅ Good - Clear intent
function getUserById(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

// ❌ Avoid - Unclear return type
function getUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}
```

### 2. Null Safety

Handle null and undefined explicitly:

```typescript
// ✅ Good - Explicit null handling
const user = await getUserById(id);
if (!user) {
  throw new Error("User not found");
}
return user.name;

// ❌ Avoid - Implicit null access
const user = await getUserById(id);
return user.name; // Could throw if user is null
```

### 3. Type Guards

Use type guards for runtime type safety:

```typescript
// ✅ Good - Type guard
function isString(value: unknown): value is string {
  return typeof value === "string";
}

if (isString(data)) {
  // TypeScript knows data is string here
  return data.toUpperCase();
}

// ❌ Avoid - Type assertion without checking
return (data as string).toUpperCase();
```

---

## Common Patterns

### Function Signatures

Always include return types for public functions:

```typescript
// ✅ Good - Explicit return type
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.cuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    ...overrides,
  };
}

// ⚠️ Acceptable in private/internal functions
function formatDate(date: Date) {
  return date.toISOString();
}
```

### Object Construction

Use explicit typing for complex objects:

```typescript
// ✅ Good - Explicit interface
interface CreateUserRequest {
  email: string;
  name?: string;
  organizationId: string;
}

const request: CreateUserRequest = {
  email: input.email,
  organizationId: ctx.session.user.organizationId,
};

// ✅ Also good - Type assertion with validation
const request = {
  email: input.email,
  organizationId: ctx.session.user.organizationId,
} satisfies CreateUserRequest;
```

### Error Handling

Prefer typed errors over generic throws:

```typescript
// ✅ Good - Typed error
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// ✅ Good - Error handling
try {
  await createUser(data);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error specifically
    return { error: error.message, field: error.field };
  }
  // Handle other errors
  throw error;
}
```

### Array Operations

Safe array access and manipulation:

```typescript
// ✅ Good - Safe array access
const users = await getUsers();
const firstUser = users[0];
if (firstUser) {
  console.log(firstUser.name);
}

// ✅ Good - Array operations with type preservation
const userNames: string[] = users
  .filter((user): user is User => user.name !== null)
  .map((user) => user.name);
```

---

## Testing-Specific Patterns

### Mock Creation

Type-safe mock creation patterns:

```typescript
// ✅ Good - Typed mock factory
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: faker.string.cuid(),
    userId: faker.string.cuid(),
    expires: faker.date.future(),
    sessionToken: faker.string.uuid(),
    ...overrides,
  };
}

// Usage
const session = createMockSession({ userId: "specific-id" });
```

### Test Utilities

Reusable test utilities with proper typing:

```typescript
// ✅ Good - Generic test helper
export function createMockTRPCContext<T extends object>(
  overrides: Partial<T> = {},
): T & { db: PrismaClient } {
  return {
    db: mockDb,
    session: null,
    ...overrides,
  } as T & { db: PrismaClient };
}
```

### Assertion Helpers

Type-safe test assertions:

```typescript
// ✅ Good - Custom assertion with type guard
export function assertIsUser(value: unknown): asserts value is User {
  if (!value || typeof value !== "object") {
    throw new Error("Expected User object");
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.email !== "string") {
    throw new Error("Invalid User structure");
  }
}

// Usage in tests
const result = await getUserById("123");
assertIsUser(result);
// TypeScript now knows result is User
expect(result.email).toBe("test@example.com");
```

---

## Extra Relaxed Patterns for Test Files

**Test files** (`*.test.ts`, `*.spec.ts`) use `tsconfig.tests.json` with additional flexibility:

### Allowed in Test Files Only

#### Any Types for Mocking

```typescript
// ✅ Allowed in test files - Mock with any
const mockPrisma = {
  user: {
    findUnique: vi.fn().mockResolvedValue(null as any),
    create: vi.fn().mockImplementation((data: any) => data),
  },
} as any;
```

#### Flexible Mock Assertions

```typescript
// ✅ Allowed in test files - Flexible assertion
expect(mockFunction).toHaveBeenCalledWith(
  expect.objectContaining({
    id: expect.any(String),
    data: expect.anything(),
  }),
);
```

#### Quick Test Data

```typescript
// ✅ Allowed in test files - Quick test objects
const testUser = {
  id: "test-id",
  email: "test@example.com",
  // Missing other required fields - OK for focused tests
} as User;
```

#### Non-null Assertions for Known Test Data

```typescript
// ✅ Allowed in test files - When you know data exists
const user = users.find((u) => u.id === "test-id")!;
expect(user.name).toBe("Test User");
```

### Still Recommended in Test Files

Even with relaxed rules, prefer good patterns when practical:

```typescript
// ✅ Still good - Type-safe even in tests when easy
const mockUser: User = createMockUser({ id: "test-id" });

// ✅ Still good - Proper error expectations
await expect(async () => {
  await deleteUser("nonexistent");
}).rejects.toThrow("User not found");
```

---

## Migration Path to Strictest

### When Moving Code to Production

If moving test utility code to production (`src/`), upgrade patterns:

```typescript
// Test utility version (base standards)
export function createUser(data: Partial<User>) {
  return {
    id: data.id || faker.string.cuid(),
    email: data.email || faker.internet.email(),
    name: data.name || null,
  };
}

// Production version (strictest standards)
export function createUser(data: Partial<User>): User {
  const user: User = {
    id: faker.string.cuid(),
    email: faker.internet.email(),
    name: null,
  };

  if (data.id) user.id = data.id;
  if (data.email) user.email = data.email;
  if (data.name !== undefined) user.name = data.name;

  return user;
}
```

### Gradual Strictness Adoption

You can gradually adopt stricter patterns:

1. **Start with explicit return types**
2. **Add null checking**
3. **Improve error handling**
4. **Use type guards instead of assertions**
5. **Eventually move to strictest patterns**

---

## Common Pitfalls

### Avoid These Anti-Patterns

#### Over-using `any`

```typescript
// ❌ Avoid - Even in test utilities
function processData(data: any): any {
  return data.someField;
}

// ✅ Better - Use generics or union types
function processData<T extends { someField: unknown }>(
  data: T,
): T["someField"] {
  return data.someField;
}
```

#### Unsafe Type Assertions

```typescript
// ❌ Avoid - Unsafe assertion
const user = response.data as User;

// ✅ Better - Validate before asserting
function isUser(data: unknown): data is User {
  return data !== null && typeof data === "object" && "id" in data;
}

if (isUser(response.data)) {
  const user = response.data; // TypeScript knows this is User
}
```

#### Ignoring Null Possibilities

```typescript
// ❌ Avoid - Ignoring null possibility
const user = await findUser(id);
return user.name; // Could throw if user is null

// ✅ Better - Handle null explicitly
const user = await findUser(id);
if (!user) {
  throw new Error("User not found");
}
return user.name;
```

---

## Tools and Validation

### TypeScript Configuration

Test utilities use `tsconfig.test-utils.json` with these key settings:

- `strict: true` - Basic strict mode
- `exactOptionalPropertyTypes: false` - More flexible than production
- `noUncheckedIndexedAccess: false` - Allow array access without bounds checking

### ESLint Rules

Base standards enforce:

- `@typescript-eslint/no-explicit-any: "warn"` - Warn on any usage
- `@typescript-eslint/explicit-function-return-type: "warn"` - Prefer return types
- Most type-unsafe rules as warnings, not errors

### Validation Commands

```bash
# Check test utilities TypeScript
npx tsc -p tsconfig.test-utils.json --noEmit

# Check ESLint for test utilities
npx eslint "src/test/**/*.{ts,tsx}"
```

---

## Related Documentation

- **[TypeScript Strictest Production](./typescript-strictest-production.md)** - Advanced patterns for production code
- **[Multi-Config Strategy](../configuration/multi-config-strategy.md)** - Understanding the config system
- **[Testing Best Practices](../testing/vitest-best-practices.md)** - Vitest patterns and testing strategies

**Last Updated**: July 25, 2025
