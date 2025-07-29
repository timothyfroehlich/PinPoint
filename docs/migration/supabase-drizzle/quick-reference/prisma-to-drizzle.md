# Prisma to Drizzle Quick Reference

Quick syntax mapping for common patterns. For complete guide, see [Drizzle Developer Guide](../../developer-guides/drizzle/).

## Schema Definition

```typescript
// Prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}

// Drizzle
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  email: text("email").unique().notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## Basic Queries

```typescript
// Prisma
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Drizzle
const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
```

## Joins

```typescript
// Prisma
const issuesWithMachine = await prisma.issue.findMany({
  where: { organizationId },
  include: { machine: true },
});

// Drizzle
const issuesWithMachine = await db
  .select()
  .from(issues)
  .innerJoin(machines, eq(issues.machineId, machines.id))
  .where(eq(issues.organizationId, organizationId));
```

## Updates

```typescript
// Prisma
await prisma.issue.update({
  where: { id },
  data: { statusId, assignedToId },
});

// Drizzle
await db
  .update(issues)
  .set({ statusId, assignedToId })
  .where(eq(issues.id, id));
```

## Transactions

```typescript
// Prisma
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data });
  await tx.member.create({ data: { userId: user.id } });
});

// Drizzle
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values(data).returning();
  await tx.insert(members).values({ userId: user.id });
});
```

For more patterns, see [Drizzle Query Patterns](../../developer-guides/drizzle/query-patterns.md).
