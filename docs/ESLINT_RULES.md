# ESLint Configuration Guide

**Last Updated**: November 10, 2025
**Philosophy**: Clean from the start, comprehensive without complexity

## Rule Categories

### 🧹 Code Quality

**`unused-imports/no-unused-imports`** - Error
Catches dead code and stale imports. Auto-fixable.

```ts
// ❌ Bad - unused import
import { useState } from "react";

// ✅ Good - import removed automatically
export function MyComponent() { ... }
```

**`unused-imports/no-unused-vars`** - Warn
Detects unused variables. Allows `_` prefix for intentionally unused.

```ts
// ❌ Bad
function handleClick(event) {
  console.log("clicked");
}

// ✅ Good - explicit unused marker
function handleClick(_event) {
  console.log("clicked");
}
```

**`@typescript-eslint/explicit-function-return-type`** - Error
Prevents type inference errors by requiring explicit return types.

```ts
// ❌ Bad - implicit return type
export function getUser(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

// ✅ Good - explicit return type
export function getUser(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}
```

---

### 📦 Import Organization

**`@typescript-eslint/consistent-type-imports`** - Error
Separates type imports for cleaner code and better tree-shaking.

```ts
// ❌ Bad
import { User } from "~/lib/types";

// ✅ Good
import type { User } from "~/lib/types";
```

**`no-restricted-imports` (deep relative)** - Error
Enforces path aliases to prevent brittle relative imports.

```ts
// ❌ Bad
import { createClient } from "../../../lib/supabase/server";

// ✅ Good
import { createClient } from "~/lib/supabase/server";
```

---

### 🛡️ TypeScript Safety

**`@typescript-eslint/no-explicit-any`** - Error
Prevents type safety escape hatches.

```ts
// ❌ Bad
function processData(data: any) { ... }

// ✅ Good
function processData(data: unknown) {
  if (typeof data === "object" && data !== null) { ... }
}
```

**`@typescript-eslint/no-unnecessary-condition`** - Error
Catches redundant checks that indicate logic errors.

```ts
// ❌ Bad - x is always string
function greet(x: string) {
  if (x !== undefined) {
    // Unnecessary check
    console.log(x);
  }
}

// ✅ Good
function greet(x: string | undefined) {
  if (x !== undefined) {
    console.log(x);
  }
}
```

**`@typescript-eslint/ban-ts-comment`** - Error
Prevents suppressing type errors without explanation.

```ts
// ❌ Bad
// @ts-ignore
const result = dangerousOperation();

// ✅ Good
// @ts-expect-error: Legacy API returns any, safe to cast based on docs
const result = dangerousOperation() as SafeType;
```

---

### 🎯 Promise Handling

**`@typescript-eslint/no-floating-promises`** - Error
Prevents fire-and-forget async bugs.

```ts
// ❌ Bad - promise not awaited or handled
async function saveUser(user: User) {
  db.insert(users).values(user); // Fire and forget!
}

// ✅ Good - await the promise
async function saveUser(user: User) {
  await db.insert(users).values(user);
}
```

**`@typescript-eslint/no-misused-promises`** - Error
Catches async/await misuse in conditionals and callbacks.

```ts
// ❌ Bad - async in if condition
if (await checkUser()) { ... }

// ✅ Good
const isValid = await checkUser();
if (isValid) { ... }
```

**`promise/catch-or-return`** - Error
Ensures promises are properly handled.

```ts
// ❌ Bad
fetchData().then(processData);

// ✅ Good
fetchData().then(processData).catch(handleError);
```

**`promise/no-nesting`** - Warn
Prevents callback hell with promises.

```ts
// ❌ Bad
fetchUser().then((user) => {
  fetchPosts(user.id).then((posts) => {
    // Nested promises
  });
});

// ✅ Good
const user = await fetchUser();
const posts = await fetchPosts(user.id);
```

---

## Special Overrides

### Test Files

Test files have relaxed rules for pragmatic testing:

- `@typescript-eslint/no-explicit-any`: off (mocking)
- `@typescript-eslint/no-floating-promises`: off (test runners handle)
- `@typescript-eslint/explicit-function-return-type`: off (concise tests)

### Config Files

Build and config files have relaxed type checking:

- `@typescript-eslint/no-explicit-any`: off
- `@typescript-eslint/explicit-function-return-type`: off
- `no-restricted-imports`: off

---

## Common Patterns

### Server Components

```ts
import type { User } from "~/lib/types";

export default async function UserProfile({
  userId,
}: {
  userId: string;
}): Promise<JSX.Element> {
  const user = await getUser(userId);

  if (!user) {
    return <div>User not found</div>;
  }

  return <div>{user.name}</div>;
}
```

### Server Actions

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { User } from "~/lib/types";

export async function updateUser(
  userId: string,
  data: Partial<User>
): Promise<{ success: boolean }> {
  await db.update(users).set(data).where(eq(users.id, userId));
  revalidatePath("/profile");
  return { success: true };
}
```

---

## Why These Rules?

| Rule                     | Catches               | Example Bug                                    |
| ------------------------ | --------------------- | ---------------------------------------------- |
| No floating promises     | Unhandled errors      | Database write fails silently                  |
| No unused imports        | Code bloat            | 50KB of unused React imports                   |
| Explicit return types    | Type inference errors | `undefined` returned when expecting object     |
| No deep relative imports | Refactoring breaks    | Moving a file breaks 20+ imports               |
| No explicit any          | Type safety holes     | Wrong data type passed to API                  |
| No unnecessary condition | Logic errors          | Checking for null when value is always defined |

---

## Adding New Rules

When adding rules, ask:

1. **Does it catch real bugs?** (not just style)
2. **Is it auto-fixable?** (prefer yes)
3. **Does it have clear documentation?** (explain the "why")
4. **Does it work with our stack?** (Next.js, React 19, Drizzle)

**Prefer warnings over errors** for new rules until proven valuable in practice.

---

## Resources

- [TypeScript ESLint](https://typescript-eslint.io/)
- [ESLint Promise Plugin](https://github.com/eslint-community/eslint-plugin-promise)
- [Unused Imports Plugin](https://github.com/sweepline/eslint-plugin-unused-imports)
