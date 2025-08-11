# Prisma → Drizzle: Direct Conversion Guide

Modern Drizzle patterns for direct migration (no parallel validation). Use Context7 for latest Drizzle documentation.

## 🚨 Context7 Research First

```bash
# Always verify current patterns before conversion
resolve-library-id "drizzle orm"
get-library-docs /drizzle-team/drizzle-orm --topic="relational queries generated columns"
```

---

## 🎯 Direct Conversion Philosophy

**Solo Development Approach:**

- Convert one router at a time
- Clean Drizzle implementations (no Prisma remnants)
- Use relational queries over manual joins
- Leverage generated columns for computed fields
- TypeScript compilation as safety net

---

## 🗄️ Schema Evolution

### Basic Table Definition

```typescript
// Prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}

// Drizzle (Direct Conversion)
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  email: text("email").unique().notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
})
```

### Generated Columns (New Capability)

```typescript
// Move computed logic to database
export const posts = pgTable("posts", {
  title: text("title").notNull(),
  content: text("content").notNull(),

  // Replace application-layer search logic
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    sql`setweight(to_tsvector('english', title), 'A') || 
        setweight(to_tsvector('english', content), 'B')`,
    { mode: "stored" },
  ),
});
```

### Relations Definition

```typescript
// Define relationships for relational queries
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  comments: many(comments),
}));
```

---

## 🔄 Query Pattern Migration

### Simple Queries

```typescript
// Prisma
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Drizzle (Direct Conversion)
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
});
```

### Relational Queries (Replaces Include)

```typescript
// Prisma include pattern
const postsWithAuthor = await prisma.post.findMany({
  where: { organizationId },
  include: {
    author: true,
    comments: { include: { author: true } },
  },
});

// Drizzle relational queries (Direct Conversion)
const postsWithAuthor = await db.query.posts.findMany({
  where: eq(posts.organizationId, organizationId),
  with: {
    author: true,
    comments: { with: { author: true } },
  },
});
```

### Complex Filtering

```typescript
// Prisma
const issues = await prisma.issue.findMany({
  where: {
    organizationId,
    status: { in: ["open", "in-progress"] },
    createdAt: { gte: startDate },
  },
});

// Drizzle (Direct Conversion)
const issuesList = await db.query.issues.findMany({
  where: and(
    eq(issues.organizationId, organizationId),
    inArray(issues.status, ["open", "in-progress"]),
    gte(issues.createdAt, startDate),
  ),
});
```

---

## ✍️ Mutation Patterns

### Create Operations

```typescript
// Prisma
const user = await prisma.user.create({
  data: { name, email, organizationId },
});

// Drizzle (Direct Conversion)
const [user] = await db
  .insert(users)
  .values({ name, email, organizationId })
  .returning();
```

### Update Operations

```typescript
// Prisma
await prisma.issue.update({
  where: { id },
  data: { statusId, assignedToId },
});

// Drizzle (Direct Conversion)
await db
  .update(issues)
  .set({ statusId, assignedToId, updatedAt: new Date() })
  .where(eq(issues.id, id));
```

### Upsert Pattern

```typescript
// Prisma upsert
await prisma.userPreference.upsert({
  where: { userId },
  create: { userId, theme: "dark" },
  update: { theme: "dark" },
});

// Drizzle (Direct Conversion)
await db
  .insert(userPreferences)
  .values({ userId, theme: "dark" })
  .onConflictDoUpdate({
    target: userPreferences.userId,
    set: { theme: "dark", updatedAt: new Date() },
  });
```

---

## 🔐 Organizational Scoping (Multi-Tenancy)

### Maintain Security Boundaries

```typescript
// Prisma with RLS-like pattern
const posts = await prisma.post.findMany({
  where: { organizationId: ctx.user.organizationId },
});

// Drizzle (Direct Conversion) - Keep scoping
const posts = await db.query.posts.findMany({
  where: eq(posts.organizationId, ctx.user.organizationId),
});
```

### Scoped Helper Functions

```typescript
// Create scoped query helpers
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

---

## 🧪 Testing Integration

### PGlite Setup for Router Tests

```typescript
// vitest.setup.ts
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

### Router Test Updates

```typescript
// Update existing router tests for Drizzle
const mockDb = vi.hoisted(() => ({
  query: {
    users: { findMany: vi.fn(), findFirst: vi.fn() },
    posts: { findMany: vi.fn() },
  },
  insert: vi.fn().mockReturnValue({ returning: vi.fn() }),
  update: vi.fn().mockReturnValue({ where: vi.fn() }),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

test("user creation with org scoping", async () => {
  mockDb.insert.mockReturnValue({
    returning: vi
      .fn()
      .mockResolvedValue([{ id: "1", organizationId: "org-1" }]),
  });

  const result = await caller.user.create({
    name: "Test",
    email: "test@example.com",
  });
  expect(result.organizationId).toBe(ctx.user.organizationId);
});
```

---

## 🚦 Conversion Workflow

### Router-by-Router Process

**1. Pre-Conversion:**

```typescript
// Read existing Prisma patterns
const issues = await ctx.prisma.issue.findMany({
  where: { organizationId: ctx.user.organizationId },
  include: { machine: true },
});
```

**2. Direct Conversion:**

```typescript
// Clean Drizzle implementation
const issues = await ctx.db.query.issues.findMany({
  where: eq(issues.organizationId, ctx.user.organizationId),
  with: { machine: true },
});
```

**3. Validation:**

- TypeScript compilation passes
- Manual testing of key flows
- Organizational scoping maintained

---

## ⚠️ Migration Pitfalls

**Schema Issues:**

- ❌ Forgetting to define relations for relational queries
- ✅ Define both table and relations exports
- ❌ Using old index syntax `.asc()` on index
- ✅ Use column-specific modifiers `.on(table.col.asc())`

**Query Conversion:**

- ❌ Manual joins instead of relational queries
- ✅ Use `with` for related data fetching
- ❌ Prisma-style `findUnique` patterns
- ✅ Use `findFirst` with proper where clauses

**Testing Updates:**

- ❌ Keeping Prisma-style test mocks
- ✅ Update mocks to match Drizzle query structure
- ❌ External database dependencies
- ✅ PGlite in-memory for fast feedback

---

## 📋 Daily Conversion Checklist

**Before Converting Each Procedure:**

- [ ] Identify Prisma patterns used
- [ ] Plan Drizzle equivalent approach
- [ ] Check for computed field opportunities
- [ ] Prepare test mock updates

**During Conversion:**

- [ ] Replace Prisma queries with Drizzle
- [ ] Maintain organizational scoping
- [ ] Use relational queries for includes
- [ ] Test TypeScript compilation

**After Conversion:**

- [ ] Update procedure tests
- [ ] Manual testing of key flows
- [ ] Document any behavior changes
- [ ] Commit with clear message

---

_Complete conversion strategy: @docs/migration/supabase-drizzle/direct-conversion-plan.md_
