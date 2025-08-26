# Utility Functions

This directory contains utility functions for the PinPoint application, organized by functionality.

## Boundary Convention

PinPoint follows a strict **boundary convention** for data transformation:

- **Database Layer**: Uses `snake_case` field names (e.g., `user_id`, `created_at`)
- **Application Layer**: Uses `camelCase` field names (e.g., `userId`, `createdAt`)

### When to Use Transformers

**Use `transformKeysToCamelCase()`** when:

- Converting database query results to application types
- At API router boundaries when returning data to the frontend
- In service functions that process database results

**Use `transformKeysToSnakeCase()`** when:

- Converting application data to database format for inserts/updates
- Preparing data for database queries with dynamic conditions

### Examples

#### In API Routers

```typescript
// ✅ Convert DB results to camelCase for frontend
export const getUser = publicProcedure.query(async ({ ctx }) => {
  const dbUser = await ctx.db.select().from(users).where(eq(users.id, userId));
  return transformKeysToCamelCase(dbUser); // snake_case → camelCase
});

// ✅ Convert frontend data to snake_case for DB operations
export const updateUser = publicProcedure
  .input(z.object({ userId: z.string(), firstName: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const dbData = transformKeysToSnakeCase(input); // camelCase → snake_case
    return ctx.db.update(users).set(dbData).where(eq(users.id, input.userId));
  });
```

#### In Service Functions

```typescript
// ✅ Transform at service boundaries
export async function getUserMemberships(userId: string) {
  const dbResults = await db
    .select()
    .from(memberships)
    .where(eq(memberships.user_id, userId));

  // Transform to camelCase for application layer
  return transformKeysToCamelCase(dbResults);
}
```

#### Validation Transformers

```typescript
// ✅ Boundary transformers for validation functions
const dbMembership = await db.query.memberships.findFirst(/* ... */);
const validationData = transformMembershipForValidation(dbMembership);
// Now validationData has camelCase fields for validation functions
```

### Type Safety

Use the provided type utilities for compile-time safety:

```typescript
import type { DrizzleToCamelCase } from "./case-transformers";
import type { InferSelectModel } from "drizzle-orm";

// Database type (snake_case)
type DbUser = InferSelectModel<typeof users>;

// Application type (camelCase)
type AppUser = DrizzleToCamelCase<DbUser>;
```

### Important Notes

1. **Transform at boundaries**: Always transform data when crossing between database and application layers
2. **Preserve non-plain objects**: Transformers automatically preserve Date objects, Maps, Sets, and other non-plain objects
3. **Use specialized transformers**: For validation functions, use the specialized transformers in `membership-transformers.ts`
4. **Avoid dual persistence**: Don't persist both snake_case and camelCase versions of the same data

## Available Utilities

### Case Transformers (`case-transformers.ts`)

- `toCamelCase()` / `toSnakeCase()` - String transformations
- `transformKeysToCamelCase()` / `transformKeysToSnakeCase()` - Deep object transformations
- Type utilities: `CamelCased<T>`, `SnakeCased<T>`, `DrizzleToCamelCase<T>`

### Membership Transformers (`membership-transformers.ts`)

- `transformMembershipForValidation()` - Convert DB membership to validation format
- `transformRoleForValidation()` - Convert DB role to validation format

### Other Utilities

- `id-generation.ts` - Generate secure UUIDs
- `image-processing.ts` - Image processing and validation

All utilities are exported through the barrel file `index.ts` for convenient importing.
