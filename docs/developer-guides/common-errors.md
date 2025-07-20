# Common ESLint Errors and Fixes

This guide provides specific solutions for ESLint rule violations commonly encountered with TypeScript strictest mode and type-aware linting.

## Quick Reference

For essential patterns, see [CLAUDE.md TypeScript Guidelines](../../CLAUDE.md#typescript-strictest-mode-guidelines). This guide covers specific ESLint rules and their violations.

## Type-Safety Rules (@typescript-eslint)

### @typescript-eslint/no-explicit-any

**Error**: Using `any` type defeats TypeScript's type safety.

**❌ Bad Examples:**

```typescript
// Using any for API responses
const data: any = await fetch("/api/users");

// Using any in function parameters
function processData(input: any): void {}

// Using any in test mocks
const mockFn = jest.fn() as any;
```

**✅ Solutions:**

```typescript
// Define proper types for API responses
interface UserResponse {
  users: User[];
  total: number;
}
const data: UserResponse = await fetch("/api/users").then((r) => r.json());

// Use generic types for flexible functions
function processData<T>(input: T): void {}

// Use proper generic types for mocks
const mockFn = jest.fn<Promise<User>, [string]>();
```

### @typescript-eslint/no-unsafe-assignment

**Error**: Assigning values of type `any` or `unknown` without type checking.

**❌ Bad Examples:**

```typescript
// Assigning unknown API response
const response = await apiCall();
const userName = response.user.name; // Unsafe assignment

// Assigning any to typed variable
let userData: UserData;
userData = someAnyValue; // Unsafe
```

**✅ Solutions:**

```typescript
// Use type guards for unknown values
const response: unknown = await apiCall();
if (isValidUserResponse(response)) {
  const userName = response.user.name; // Safe after validation
}

// Define type guard
function isValidUserResponse(
  data: unknown,
): data is { user: { name: string } } {
  return (
    typeof data === "object" &&
    data !== null &&
    "user" in data &&
    typeof (data as any).user?.name === "string"
  );
}

// Use proper typing from the start
interface ApiResponse {
  user: { name: string };
}
const response: ApiResponse = await apiCall();
const userName = response.user.name; // Safe with proper typing
```

### @typescript-eslint/no-unsafe-member-access

**Error**: Accessing properties on values of type `any` or `unknown`.

**❌ Bad Examples:**

```typescript
// Accessing properties on any
function handleResponse(response: any) {
  return response.data.items; // Unsafe member access
}

// Accessing properties on unknown
function processUnknown(data: unknown) {
  return data.someProperty; // Unsafe member access
}
```

**✅ Solutions:**

```typescript
// Define interface and use type assertion
interface ApiResponse {
  data: { items: Item[] };
}

function handleResponse(response: ApiResponse) {
  return response.data.items; // Safe with proper typing
}

// Use type guards for unknown data
function processUnknown(data: unknown) {
  if (isValidData(data)) {
    return data.someProperty; // Safe after type guard
  }
  throw new Error("Invalid data structure");
}

function isValidData(data: unknown): data is { someProperty: string } {
  return typeof data === "object" && data !== null && "someProperty" in data;
}
```

### @typescript-eslint/no-unsafe-call

**Error**: Calling functions with `any` or `unknown` types.

**❌ Bad Examples:**

```typescript
// Calling any function
const result = (someFunction as any)(param1, param2);

// Calling method on any object
const response: any = await apiCall();
const processed = response.process();
```

**✅ Solutions:**

```typescript
// Use proper function typing
type ProcessFunction = (param1: string, param2: number) => Result;
const someFunction = knownFunction as ProcessFunction;
const result = someFunction(param1, param2);

// Define interface with methods
interface ApiResponse {
  process(): ProcessedData;
}

const response: ApiResponse = await apiCall();
const processed = response.process(); // Safe with proper interface
```

### @typescript-eslint/no-unsafe-return

**Error**: Returning values of type `any` from functions.

**❌ Bad Examples:**

```typescript
// Returning any from function
function getData(): UserData {
  const response: any = callApi();
  return response; // Unsafe return
}

// Returning unknown without validation
function processData(): string {
  const result: unknown = transform();
  return result; // Unsafe return
}
```

**✅ Solutions:**

```typescript
// Validate before returning
function getData(): UserData {
  const response: unknown = callApi();
  if (isUserData(response)) {
    return response; // Safe after validation
  }
  throw new Error("Invalid user data received");
}

function isUserData(data: unknown): data is UserData {
  return (
    typeof data === "object" && data !== null && "id" in data && "name" in data
  );
}

// Use proper return types
function processData(): string {
  const result = transform(); // Ensure transform returns string
  return result;
}
```

### @typescript-eslint/no-unsafe-argument

**Error**: Passing `any` or `unknown` values as function arguments.

**❌ Bad Examples:**

```typescript
// Passing any to typed function
function saveUser(userData: UserData): void {}

const data: any = getUserInput();
saveUser(data); // Unsafe argument

// Passing unknown without validation
function processItems(items: Item[]): void {}

const unknownItems: unknown = getItems();
processItems(unknownItems); // Unsafe argument
```

**✅ Solutions:**

```typescript
// Validate before passing
const data: unknown = getUserInput();
if (isValidUserData(data)) {
  saveUser(data); // Safe after validation
}

// Type guard for array validation
const unknownItems: unknown = getItems();
if (isItemArray(unknownItems)) {
  processItems(unknownItems); // Safe after validation
}

function isItemArray(data: unknown): data is Item[] {
  return Array.isArray(data) && data.every((item) => isValidItem(item));
}

function isValidItem(data: unknown): data is Item {
  return typeof data === "object" && data !== null && "id" in data;
}
```

## Code Style Rules

### @typescript-eslint/ban-ts-comment

**Error**: Using TypeScript comment directives without descriptions.

**❌ Bad Examples:**

```typescript
// @ts-ignore
const value = problematicFunction();

// @ts-expect-error
const result = legacyCode();
```

**✅ Solutions:**

```typescript
// @ts-expect-error - Legacy API returns inconsistent types, fix in v2.0
const value = problematicFunction();

// Better: Fix the underlying issue instead of suppressing
const value: ExpectedType = problematicFunction() as ExpectedType;

// Best: Use proper types
interface LegacyResponse {
  /* proper interface */
}
const result: LegacyResponse = legacyCode();
```

### @typescript-eslint/no-unused-vars

**Error**: Variables declared but not used.

**❌ Bad Examples:**

```typescript
function processUser(id: string, name: string) {
  const unusedVar = calculateSomething();
  return `User: ${id}`;
}

// Unused function parameters
function handleClick(event: MouseEvent, unusedParam: string) {
  console.log("Clicked");
}
```

**✅ Solutions:**

```typescript
// Remove unused variables
function processUser(id: string, name: string) {
  return `User: ${id}`;
}

// Use underscore prefix for intentionally unused parameters
function handleClick(event: MouseEvent, _unusedParam: string) {
  console.log("Clicked");
}

// Or omit unused parameters if possible
function handleClick(event: MouseEvent) {
  console.log("Clicked");
}
```

### @typescript-eslint/unbound-method

**Error**: Using class methods without binding `this` context.

**❌ Bad Examples:**

```typescript
class UserService {
  private apiKey = "secret";

  async getUser(id: string) {
    return fetch(`/api/users/${id}`, {
      headers: { Authorization: this.apiKey },
    });
  }
}

const service = new UserService();
const getData = service.getUser; // Unbound method
getData("123"); // `this` is undefined
```

**✅ Solutions:**

```typescript
// Option 1: Bind the method
const service = new UserService();
const getData = service.getUser.bind(service);
getData("123"); // `this` correctly bound

// Option 2: Use arrow function
class UserService {
  private apiKey = "secret";

  getUser = async (id: string) => {
    return fetch(`/api/users/${id}`, {
      headers: { Authorization: this.apiKey },
    });
  };
}

// Option 3: Call method on instance
const service = new UserService();
const result = service.getUser("123"); // Call directly

// Option 4: Wrapper function
const getData = (id: string) => service.getUser(id);
```

## Project-Specific Patterns

### Prisma Client Usage

**❌ Common Mistakes:**

```typescript
// Missing null checks
const user = await prisma.user.findUnique({ where: { id } });
return user.name; // Error: user possibly null

// Unsafe typing in tests
const mockPrisma = jest.fn() as any;
```

**✅ Correct Patterns:**

```typescript
// Proper null checking
const user = await prisma.user.findUnique({ where: { id } });
if (!user) {
  throw new Error("User not found");
}
return user.name; // Safe after null check

// Proper mock typing
const mockPrisma: Partial<ExtendedPrismaClient> = {
  user: {
    findUnique: jest.fn<Promise<User | null>, [any]>(),
  },
  $accelerate: {
    invalidate: jest.fn<Promise<void>, [string]>(),
    invalidateAll: jest.fn<Promise<void>, []>(),
  },
};
```

### tRPC Context Usage

**❌ Common Mistakes:**

```typescript
// Missing session checks
function protectedProcedure(ctx: Context) {
  const userId = ctx.session.user.id; // Error: session possibly null
}

// Unsafe service access
const result = ctx.services.user.get(id); // Type not guaranteed
```

**✅ Correct Patterns:**

```typescript
// Proper session validation
function protectedProcedure(ctx: Context) {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const userId = ctx.session.user.id; // Safe after check
}

// Type-safe service access
function useUserService(ctx: Context) {
  const userService = ctx.services.user;
  if (!userService) {
    throw new Error("User service not available");
  }
  return userService; // Properly typed
}
```

### Multi-Tenant Data Access

**❌ Common Mistakes:**

```typescript
// Missing organization scoping
const games = await prisma.gameInstance.findMany(); // Returns all data

// Unsafe organization access
const orgId = ctx.session.user.organizationId; // Property doesn't exist
```

**✅ Correct Patterns:**

```typescript
// Proper organization scoping
const member = await prisma.member.findFirst({
  where: { userId: ctx.session.user.id },
});
if (!member) {
  throw new TRPCError({ code: "FORBIDDEN" });
}

const games = await prisma.gameInstance.findMany({
  where: { organizationId: member.organizationId },
});

// Get organization through membership
async function getUserOrganization(userId: string) {
  const membership = await prisma.member.findFirst({
    where: { userId },
    include: { organization: true },
  });

  if (!membership) {
    throw new Error("User not associated with any organization");
  }

  return membership.organization;
}
```

## Debugging ESLint Issues

### 1. Check Specific Rules

```bash
# Check specific ESLint rule
npm run lint -- --rule "@typescript-eslint/no-unsafe-assignment"

# Get detailed rule information
npx eslint --print-config src/server/api/routers/user.ts
```

### 2. Fix by File

```bash
# Fix specific file
npm run lint -- --fix src/path/to/file.ts

# Check single file without fixing
npm run lint -- --no-fix src/path/to/file.ts
```

### 3. Understand Rule Context

```bash
# Get rule documentation
npm run lint -- --rule "@typescript-eslint/no-explicit-any" --help

# Check what rules are active
npm run debug:lint
```

## Prevention Strategies

### 1. Use Type Guards

Create reusable type guards for common validations:

```typescript
// lib/type-guards.ts
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function hasProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}
```

### 2. Use Assertion Functions

For complex validation scenarios:

```typescript
function assertIsUser(data: unknown): asserts data is User {
  if (!isValidUser(data)) {
    throw new Error("Invalid user data");
  }
}

// Usage - throws or narrows type
const userData: unknown = await fetchUser();
assertIsUser(userData);
// userData is now typed as User
```

### 3. Leverage TypeScript Utilities

```typescript
// Use built-in utility types
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type UserEmail = Pick<User, "email">;
type UserWithoutId = Omit<User, "id">;

// Create custom utilities
type NonNullable<T> = T extends null | undefined ? never : T;
type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
```

## Related Documentation

- **Essential Patterns**: [CLAUDE.md TypeScript Guidelines](../../CLAUDE.md#typescript-strictest-mode-guidelines)
- **Comprehensive Guide**: [typescript-strictest.md](./typescript-strictest.md)
- **Testing Patterns**: [testing-patterns.md](./testing-patterns.md)
- **ESLint Configuration**: [eslint.config.js](../../eslint.config.js)
