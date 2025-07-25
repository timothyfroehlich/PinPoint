# TypeScript Strictest Production Guide

**Status**: ✅ **Active** - Required patterns for all production code  
**Audience**: Production code contributors  
**Config**: `@tsconfig/strictest` with PinPoint adaptations

---

## Overview

This guide covers **strictest-mode TypeScript patterns** required for all production code in PinPoint (`src/**/*.ts` excluding tests). These patterns build upon the [Base Standards](./typescript-base-standards.md) with additional restrictions for maximum type safety.

> **Prerequisites**: Read [Base Standards Guide](./typescript-base-standards.md) first for foundation concepts.

---

## Strictest-Specific Requirements

### 1. Exact Optional Property Types (`exactOptionalPropertyTypes`)

Optional properties cannot be assigned `undefined` explicitly:

```typescript
// ❌ Error - undefined not assignable to optional
interface UserData {
  name?: string;
}

const data: UserData = { name: value || undefined }; // Error!

// ✅ Correct - Conditional assignment
const data: UserData = {};
if (value) {
  data.name = value;
}

// ✅ Also correct - Use satisfies with proper typing
function createUserData(value: string | null): UserData {
  if (value) {
    return { name: value };
  }
  return {}; // No name property at all
}
```

### 2. Unchecked Index Access (`noUncheckedIndexedAccess`)

Array and object index access requires bounds checking:

```typescript
// ❌ Error - Array access without bounds check
function processUsers(users: User[]): string {
  return users[0].name; // Error: possibly undefined
}

// ✅ Correct - Safe array access
function processUsers(users: User[]): string {
  const firstUser = users[0];
  if (!firstUser) {
    throw new Error("No users provided");
  }
  return firstUser.name;
}

// ✅ Also correct - Using optional chaining
function processUsers(users: User[]): string | undefined {
  return users[0]?.name;
}

// ✅ Record access - Safe property access
function getValue(record: Record<string, unknown>, key: string): unknown {
  const value = record[key];
  if (value === undefined) {
    throw new Error(`Key ${key} not found`);
  }
  return value;
}
```

### 3. Strict Function Return Types

All exported functions must have explicit return types:

```typescript
// ❌ Error - Missing return type
export function createUser(data: CreateUserInput) {
  return db.user.create({ data });
}

// ✅ Correct - Explicit return type
export function createUser(data: CreateUserInput): Promise<User> {
  return db.user.create({ data });
}

// ✅ Complex return types
export function processUserData(
  input: UserInput,
): Promise<{ user: User; permissions: Permission[] }> {
  // Implementation
}
```

---

## Production-Specific Patterns

### tRPC Procedure Patterns

```typescript
// ✅ Correct - Fully typed tRPC procedure
export const getUserById = publicProcedure
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      user: UserSchema.nullable(),
      permissions: z.array(PermissionSchema),
    }),
  )
  .query(
    async ({
      input,
      ctx,
    }): Promise<{ user: User | null; permissions: Permission[] }> => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        return { user: null, permissions: [] };
      }

      const permissions = await getPermissionsForUser(user.id);
      return { user, permissions };
    },
  );
```

### Prisma Query Patterns

```typescript
// ✅ Correct - Explicit select with proper typing
export async function getUserWithOrganization(
  id: string,
): Promise<{
  id: string;
  email: string;
  organization: { name: string };
} | null> {
  return await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      organization: {
        select: {
          name: true,
        },
      },
    },
  });
}

// ✅ Correct - Type-safe where clause construction
export async function searchUsers(filters: UserSearchFilters): Promise<User[]> {
  const whereClause: Prisma.UserWhereInput = {};

  if (filters.email) {
    whereClause.email = { contains: filters.email };
  }

  if (filters.organizationId) {
    whereClause.organizationId = filters.organizationId;
  }

  return await db.user.findMany({ where: whereClause });
}
```

### Error Handling Patterns

```typescript
// ✅ Correct - Typed error classes
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = "NotFoundError";
  }
}

// ✅ Correct - Error handling with type guards
export function handleError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: { field: error.field, code: error.code },
    });
  }

  if (error instanceof NotFoundError) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
    });
  }

  // Handle unknown errors
  console.error("Unexpected error:", error);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
}
```

### Multi-Tenant Security Patterns

```typescript
// ✅ Correct - Organization-scoped queries
export async function getOrganizationIssues(
  organizationId: string,
  userId: string,
): Promise<Issue[]> {
  // Verify user belongs to organization
  const membership = await db.member.findFirst({
    where: {
      userId,
      organizationId,
    },
  });

  if (!membership) {
    throw new Error("User not authorized for this organization");
  }

  // All queries must be scoped to organization
  return await db.issue.findMany({
    where: {
      machine: {
        location: {
          organizationId, // Explicit organization scoping
        },
      },
    },
  });
}
```

---

## Advanced Type Safety Techniques

### Branded Types for IDs

```typescript
// ✅ Advanced - Branded types prevent ID confusion
declare const __brand: unique symbol;
type Brand<T, TBrand> = T & { [__brand]: TBrand };

export type UserId = Brand<string, "UserId">;
export type OrganizationId = Brand<string, "OrganizationId">;

// Helper functions for type safety
export function createUserId(id: string): UserId {
  return id as UserId;
}

export function createOrganizationId(id: string): OrganizationId {
  return id as OrganizationId;
}

// Usage prevents mixing up IDs
function transferUserToOrganization(
  userId: UserId,
  organizationId: OrganizationId,
): Promise<void> {
  // Implementation
}
```

### Exhaustive Type Checking

```typescript
// ✅ Advanced - Exhaustive switch statements
type IssueStatus = "open" | "in_progress" | "resolved" | "closed";

function getStatusColor(status: IssueStatus): string {
  switch (status) {
    case "open":
      return "red";
    case "in_progress":
      return "yellow";
    case "resolved":
      return "green";
    case "closed":
      return "gray";
    default:
      // This ensures all cases are handled
      const exhaustiveCheck: never = status;
      throw new Error(`Unhandled status: ${exhaustiveCheck}`);
  }
}
```

### Template Literal Type Safety

```typescript
// ✅ Required - All template literals must use explicit string conversion
export function logUserAction(
  userId: string,
  action: string,
  count?: number,
): void {
  // ❌ Error - number in template literal
  // console.log(`User ${userId} performed ${action} ${count} times`);

  // ✅ Correct - Explicit string conversion
  const countStr = count?.toString() ?? "unknown";
  console.log(`User ${userId} performed ${action} ${countStr} times`);
}

// ✅ Correct - Handle nullable values explicitly
export function formatUserName(
  firstName: string,
  lastName?: string | null,
): string {
  const lastNameStr = lastName ?? "Unknown";
  return `${firstName} ${lastNameStr}`;
}
```

---

## Configuration Integration

### ESLint Rules (Production Context)

Production code enforces these rules at ERROR level:

- `@typescript-eslint/no-explicit-any: "error"`
- `@typescript-eslint/no-unsafe-*: "error"`
- `@typescript-eslint/explicit-function-return-type: "warn"`
- `@typescript-eslint/restrict-template-expressions: "error"`

### TypeScript Compiler Settings

Production code uses `tsconfig.json` with:

```json
{
  "extends": ["./tsconfig.base.json", "@tsconfig/strictest/tsconfig.json"],
  "compilerOptions": {
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Betterer Integration

Production code is tracked by Betterer to prevent regressions:

- TypeScript errors are not allowed (blocks CI)
- `any` usage is not allowed (blocks CI)
- Quality must improve or remain stable

---

## Migration from Base Standards

### Upgrading Existing Code

When moving code from test utilities to production:

**1. Add Explicit Return Types:**

```typescript
// Before (test utility)
export function createMockUser(data: Partial<User>) {
  return { id: faker.string.cuid(), ...data };
}

// After (production)
export function createUser(data: Partial<User>): User {
  return {
    id: faker.string.cuid(),
    email: data.email ?? faker.internet.email(),
    name: data.name ?? null,
    ...data,
  };
}
```

**2. Handle Optional Properties:**

```typescript
// Before (base standards)
const userData = { name: data.name || undefined };

// After (strictest)
const userData: UserData = {};
if (data.name) {
  userData.name = data.name;
}
```

**3. Safe Array Access:**

```typescript
// Before (base standards - warning)
const first = items[0].name;

// After (strictest - required)
const firstItem = items[0];
if (!firstItem) {
  throw new Error("No items available");
}
const first = firstItem.name;
```

---

## Common Pitfalls and Solutions

### 1. Optional Property Assignment

```typescript
// ❌ Common mistake
interface Config {
  debug?: boolean;
}

const config: Config = {
  debug: process.env.DEBUG || undefined, // Error!
};

// ✅ Solution
const config: Config = {};
if (process.env.DEBUG) {
  config.debug = true;
}
```

### 2. Array Index Safety

```typescript
// ❌ Common mistake
function getFirstUserName(users: User[]): string {
  return users[0].name; // Error: possibly undefined
}

// ✅ Solution with clear error handling
function getFirstUserName(users: User[]): string {
  if (users.length === 0) {
    throw new Error("No users provided");
  }
  const firstUser = users[0]!; // Safe because we checked length
  return firstUser.name ?? "Unknown";
}
```

### 3. Template Literal Expressions

```typescript
// ❌ Common mistake
function formatCount(count: number): string {
  return `Total: ${count}`; // Error: number in template
}

// ✅ Solution
function formatCount(count: number): string {
  return `Total: ${count.toString()}`;
}
```

---

## Validation and Tools

### Development Commands

```bash
# Check production TypeScript (strictest)
npm run typecheck

# Lint production code with strict rules
npm run lint

# Check for regressions
npm run betterer

# Full validation pipeline
npm run validate
```

### IDE Configuration

Ensure your IDE uses the correct TypeScript configuration for production files by checking that it's using `tsconfig.json` (not the test configs) for files in `src/`.

---

## Related Documentation

- **[Base Standards](./typescript-base-standards.md)** - Foundation patterns for all code
- **[Multi-Config Strategy](../configuration/multi-config-strategy.md)** - Understanding the config system
- **[Betterer Workflow](../developer-guides/betterer-workflow.md)** - Regression prevention

**Last Updated**: July 25, 2025
