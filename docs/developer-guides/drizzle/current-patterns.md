# Current Drizzle Patterns (Post-RLS)

Current database query patterns used in PinPoint. **Phase 0-2 Complete**: Prisma removed, RLS implemented.

**🔑 Key Change**: No more manual `organizationId` filtering - RLS handles organizational scoping automatically.

## 🔄 Query Patterns

### Simple Queries

```typescript
// Single record lookup - RLS automatically scopes to user's organization  
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  // ✅ No organizationId filter needed - RLS handles it
});

// Multiple records - organizational scoping is automatic
const users = await db.query.users.findMany({
  // ✅ Only business logic filtering needed
  where: eq(users.roleId, "admin"),
});
```

### Relational Queries

```typescript
// Related data fetching with 'with' - all relations automatically scoped
const issuesWithMachines = await db.query.issues.findMany({
  // ✅ No organizationId needed anywhere - RLS ensures isolation
  where: eq(issues.statusId, "open"), 
  with: {
    machine: {
      with: {
        location: true, // All nested relations automatically scoped
      }
    },
    comments: { 
      with: { 
        author: true 
      } 
    },
  },
});
```

### Complex Filtering

```typescript
// Business logic filtering only - RLS handles organizational boundaries
const issues = await db.query.issues.findMany({
  where: and(
    // ✅ Only business logic conditions needed
    inArray(issues.statusId, ["open", "in-progress"]),
    gte(issues.createdAt, startDate),
    // ❌ No longer needed: eq(issues.organizationId, organizationId)
  ),
});
```

### Legacy vs Modern Comparison

```typescript
// ❌ OLD (Pre-RLS): Manual organizational filtering everywhere
const oldIssues = await db.query.issues.findMany({
  where: and(
    eq(issues.organizationId, ctx.organization.id), // Manual filter
    eq(issues.statusId, "open"),
    eq(issues.machineId, machineId)
  ),
  with: {
    machine: {
      where: eq(machines.organizationId, ctx.organization.id), // Manual nested filter
    }
  }
});

// ✅ NEW (Post-RLS): Clean business logic only  
const newIssues = await db.query.issues.findMany({
  where: and(
    eq(issues.statusId, "open"),
    eq(issues.machineId, machineId)
  ),
  with: {
    machine: true, // RLS automatically ensures organizational isolation
  }
});
```

## ✍️ Mutation Patterns

### Create Operations

```typescript
// Single record creation
const [user] = await db
  .insert(users)
  .values({ name, email, organizationId })
  .returning();
```

### Update Operations

```typescript
// Update with automatic timestamp
await db
  .update(issues)
  .set({ statusId, assignedToId, updatedAt: new Date() })
  .where(eq(issues.id, id));
```

### Upsert Pattern

```typescript
// Insert or update on conflict
await db
  .insert(userPreferences)
  .values({ userId, theme: "dark" })
  .onConflictDoUpdate({
    target: userPreferences.userId,
    set: { theme: "dark", updatedAt: new Date() },
  });
```

## 🔐 Organizational Scoping (Multi-Tenancy)

### Standard Security Pattern

```typescript
// Always scope by organization
const posts = await db.query.posts.findMany({
  where: eq(posts.organizationId, ctx.user.organizationId),
});
```

### Scoped Helper Functions

```typescript
// Reusable scoped query helpers
function createScopedQuery<T extends PgTableWithColumns<any>>(
  table: T,
  orgField: keyof T["_"]["columns"],
) {
  return (orgId: string) =>
    db.query[table[pgTable.Symbol.Name] as keyof typeof db.query].findMany({
      where: eq(table[orgField], orgId),
    });
}

// Usage
const getScopedPosts = createScopedQuery(posts, "organizationId");
const userPosts = await getScopedPosts(ctx.user.organizationId);
```

## 🧪 Testing Patterns

### PGlite Test Setup

```typescript
// vitest.setup.ts - current pattern
vi.mock("./src/db/index.ts", async (importOriginal) => {
  const { PGlite } = await vi.importActual("@electric-sql/pglite");
  const { drizzle } = await vi.importActual("drizzle-orm/pglite");
  const schema = await import("./src/db/schema");

  const client = new PGlite();
  const testDb = drizzle(client, { schema });

  return {
    ...(await importOriginal()),
    db: testDb,
  };
});
```

### Router Test Mocks

```typescript
// Current mock structure for router tests
const mockDb = vi.hoisted(() => ({
  query: {
    users: { findMany: vi.fn(), findFirst: vi.fn() },
    posts: { findMany: vi.fn() },
  },
  insert: vi.fn().mockReturnValue({ returning: vi.fn() }),
  update: vi.fn().mockReturnValue({ where: vi.fn() }),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
```

## 📋 Common Patterns Checklist

**Every Query Should:**

- [ ] Include organization scoping where applicable
- [ ] Use proper Drizzle operators (eq, and, inArray, etc.)
- [ ] Return proper TypeScript types

**Every Mutation Should:**

- [ ] Use `.returning()` for created/updated data
- [ ] Include `updatedAt` timestamp for updates
- [ ] Handle organization context properly

**Every Test Should:**

- [ ] Use worker-scoped database pattern
- [ ] Mock Drizzle query structure correctly
- [ ] Test organizational boundaries
