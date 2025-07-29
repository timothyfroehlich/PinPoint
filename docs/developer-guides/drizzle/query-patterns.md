# Drizzle Query Patterns

## Overview

Drizzle provides a SQL-like query builder that's fully type-safe. This guide covers common query patterns used in PinPoint.

## Basic Queries

### Select Queries

```typescript
import { eq, and, or, like, desc } from "drizzle-orm";
import { db } from "~/server/db";

// Simple select
const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

// Select with specific columns
const userEmails = await db
  .select({
    id: users.id,
    email: users.email,
  })
  .from(users)
  .where(eq(users.organizationId, orgId));

// With ordering and pagination
const recentIssues = await db
  .select()
  .from(issues)
  .where(eq(issues.organizationId, orgId))
  .orderBy(desc(issues.createdAt))
  .limit(10)
  .offset(page * 10);
```

### Insert Queries

```typescript
// Single insert with returning
const [newUser] = await db
  .insert(users)
  .values({
    email: "user@example.com",
    name: "New User",
  })
  .returning();

// Bulk insert
const newIssues = await db
  .insert(issues)
  .values([
    { title: "Issue 1", organizationId: orgId },
    { title: "Issue 2", organizationId: orgId },
  ])
  .returning({ id: issues.id });

// Insert with conflict handling
await db
  .insert(users)
  .values({ email: "user@example.com", name: "User" })
  .onConflictDoUpdate({
    target: users.email,
    set: { name: "Updated User" },
  });
```

### Update Queries

```typescript
// Simple update
await db
  .update(issues)
  .set({
    statusId: newStatusId,
    updatedAt: new Date(),
  })
  .where(eq(issues.id, issueId));

// Update with returning
const [updated] = await db
  .update(users)
  .set({ name: "New Name" })
  .where(eq(users.id, userId))
  .returning();

// Conditional update
await db
  .update(issues)
  .set({
    assignedToId: userId,
    statusId: sql`
      CASE 
        WHEN status_id = ${newStatusId} THEN status_id
        ELSE ${inProgressStatusId}
      END
    `,
  })
  .where(and(eq(issues.id, issueId), eq(issues.organizationId, orgId)));
```

### Delete Queries

```typescript
// Simple delete
await db.delete(attachments).where(eq(attachments.issueId, issueId));

// Delete with returning
const deleted = await db
  .delete(comments)
  .where(and(eq(comments.id, commentId), eq(comments.authorId, userId)))
  .returning();

// Soft delete pattern
await db
  .update(machines)
  .set({
    deletedAt: new Date(),
    deletedById: userId,
  })
  .where(eq(machines.id, machineId));
```

## Complex Queries

### Joins

```typescript
// Inner join
const issuesWithMachines = await db
  .select({
    issue: issues,
    machine: machines,
    model: models,
  })
  .from(issues)
  .innerJoin(machines, eq(issues.machineId, machines.id))
  .innerJoin(models, eq(machines.modelId, models.id))
  .where(eq(issues.organizationId, orgId));

// Left join
const usersWithMemberships = await db
  .select({
    user: users,
    membership: memberships,
    role: roles,
  })
  .from(users)
  .leftJoin(memberships, eq(users.id, memberships.userId))
  .leftJoin(roles, eq(memberships.roleId, roles.id))
  .where(eq(memberships.organizationId, orgId));

// Multiple joins with aliases
const issueDetails = await db
  .select({
    issue: issues,
    creator: {
      id: creatorUser.id,
      name: creatorUser.name,
    },
    assignee: {
      id: assigneeUser.id,
      name: assigneeUser.name,
    },
  })
  .from(issues)
  .leftJoin(creatorUser, eq(issues.createdById, creatorUser.id))
  .leftJoin(assigneeUser, eq(issues.assignedToId, assigneeUser.id))
  .where(eq(issues.id, issueId));
```

### Subqueries

```typescript
// Subquery in select
const issuesWithCommentCount = await db
  .select({
    issue: issues,
    commentCount: sql<number>`
    (SELECT COUNT(*) FROM ${comments} 
     WHERE ${comments.issueId} = ${issues.id})
  `,
  })
  .from(issues)
  .where(eq(issues.organizationId, orgId));

// Subquery in where
const sq = db
  .select({ machineId: machines.id })
  .from(machines)
  .where(eq(machines.locationId, locationId))
  .as("sq");

const locationIssues = await db
  .select()
  .from(issues)
  .where(inArray(issues.machineId, sq));

// EXISTS subquery
const usersWithIssues = await db.select().from(users).where(sql`EXISTS (
    SELECT 1 FROM ${issues} 
    WHERE ${issues.createdById} = ${users.id}
  )`);
```

### Aggregations

```typescript
// Count with group by
const issuesByStatus = await db
  .select({
    statusId: issues.statusId,
    statusName: issueStatuses.name,
    count: count(issues.id),
  })
  .from(issues)
  .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
  .where(eq(issues.organizationId, orgId))
  .groupBy(issues.statusId, issueStatuses.name);

// Multiple aggregations
const machineStats = await db
  .select({
    locationId: machines.locationId,
    totalMachines: count(machines.id),
    activeMachines: sum(
      sql<number>`CASE WHEN ${machines.deletedAt} IS NULL THEN 1 ELSE 0 END`,
    ),
    avgAge: avg(
      sql<number>`EXTRACT(epoch FROM AGE(NOW(), ${machines.createdAt}))`,
    ),
  })
  .from(machines)
  .groupBy(machines.locationId);
```

## Multi-Tenant Patterns

### Organization Scoping

```typescript
// Always scope by organization
export async function getOrganizationIssues(
  db: Database,
  organizationId: string,
  filters: IssueFilters,
) {
  const conditions = [eq(issues.organizationId, organizationId)];

  if (filters.statusId) {
    conditions.push(eq(issues.statusId, filters.statusId));
  }

  if (filters.search) {
    conditions.push(
      or(
        like(issues.title, `%${filters.search}%`),
        like(issues.description, `%${filters.search}%`),
      ),
    );
  }

  return db
    .select()
    .from(issues)
    .where(and(...conditions))
    .orderBy(desc(issues.createdAt));
}
```

### Cross-Organization Security

```typescript
// Verify resource belongs to organization
export async function updateIssue(
  db: Database,
  issueId: string,
  organizationId: string,
  data: UpdateIssueData,
) {
  // First verify the issue belongs to the organization
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(
      and(eq(issues.id, issueId), eq(issues.organizationId, organizationId)),
    )
    .limit(1);

  if (!issue) {
    throw new Error("Issue not found or access denied");
  }

  // Safe to update
  return db.update(issues).set(data).where(eq(issues.id, issueId)).returning();
}
```

## Transactions

### Basic Transactions

```typescript
export async function createIssueWithActivity(
  db: Database,
  issueData: NewIssue,
  userId: string,
) {
  return await db.transaction(async (tx) => {
    // Create issue
    const [issue] = await tx.insert(issues).values(issueData).returning();

    // Create activity log
    await tx.insert(activities).values({
      entityType: "issue",
      entityId: issue.id,
      action: "created",
      actorId: userId,
      metadata: { title: issue.title },
    });

    // Create notification
    await tx.insert(notifications).values({
      userId: issue.machineOwnerId,
      type: "new_issue",
      data: { issueId: issue.id },
    });

    return issue;
  });
}
```

### Rollback on Error

```typescript
export async function transferMachine(
  db: Database,
  machineId: string,
  fromLocationId: string,
  toLocationId: string,
) {
  try {
    return await db.transaction(async (tx) => {
      // Verify source location
      const [machine] = await tx
        .select()
        .from(machines)
        .where(
          and(
            eq(machines.id, machineId),
            eq(machines.locationId, fromLocationId),
          ),
        )
        .limit(1);

      if (!machine) {
        throw new Error("Machine not found at source location");
      }

      // Update machine location
      await tx
        .update(machines)
        .set({ locationId: toLocationId })
        .where(eq(machines.id, machineId));

      // Log transfer
      await tx.insert(transfers).values({
        machineId,
        fromLocationId,
        toLocationId,
        transferredAt: new Date(),
      });

      return { success: true };
    });
  } catch (error) {
    // Transaction automatically rolled back
    return { success: false, error: error.message };
  }
}
```

## Performance Patterns

### Batch Operations

```typescript
// Batch update with CASE
export async function batchUpdateIssueStatus(
  db: Database,
  updates: Array<{ id: string; statusId: string }>,
) {
  if (updates.length === 0) return;

  const sqlChunks: SQL[] = [];
  const ids: string[] = [];

  sqlChunks.push(sql`UPDATE ${issues} SET status_id = CASE`);

  for (const { id, statusId } of updates) {
    sqlChunks.push(sql`WHEN id = ${id} THEN ${statusId}`);
    ids.push(id);
  }

  sqlChunks.push(sql`END WHERE id IN (${sql.join(ids, sql`, `)})`);

  await db.execute(sql.join(sqlChunks, sql` `));
}
```

### Cursor Pagination

```typescript
export async function getIssuesCursor(
  db: Database,
  organizationId: string,
  cursor?: { id: string; createdAt: Date },
  limit: number = 20,
) {
  const conditions = [eq(issues.organizationId, organizationId)];

  if (cursor) {
    conditions.push(
      or(
        lt(issues.createdAt, cursor.createdAt),
        and(eq(issues.createdAt, cursor.createdAt), gt(issues.id, cursor.id)),
      ),
    );
  }

  const results = await db
    .select()
    .from(issues)
    .where(and(...conditions))
    .orderBy(desc(issues.createdAt), asc(issues.id))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore
    ? {
        id: items[items.length - 1].id,
        createdAt: items[items.length - 1].createdAt,
      }
    : null;

  return { items, nextCursor, hasMore };
}
```

## ⚠️ MIGRATION: Prisma Query Patterns

### Basic Query Differences

```typescript
// OLD: Prisma
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { memberships: true },
});

// NEW: Drizzle (with joins)
const userWithMemberships = await db
  .select()
  .from(users)
  .leftJoin(memberships, eq(users.id, memberships.userId))
  .where(eq(users.id, userId));

// NEW: Drizzle (with query API - coming soon)
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { memberships: true },
});
```

### Transaction Differences

```typescript
// OLD: Prisma $transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data });
  const membership = await tx.membership.create({ data });
  return { user, membership };
});

// NEW: Drizzle transaction
const result = await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values(data).returning();
  const [membership] = await tx
    .insert(memberships)
    .values({ userId: user.id })
    .returning();
  return { user, membership };
});
```

### Include vs Join

```typescript
// OLD: Prisma include
const issueWithAll = await prisma.issue.findUnique({
  where: { id },
  include: {
    machine: {
      include: {
        model: true,
        location: true,
      },
    },
    status: true,
    createdBy: true,
  },
});

// NEW: Drizzle joins
const issueWithAll = await db
  .select({
    issue: issues,
    machine: machines,
    model: models,
    location: locations,
    status: issueStatuses,
    createdBy: users,
  })
  .from(issues)
  .innerJoin(machines, eq(issues.machineId, machines.id))
  .innerJoin(models, eq(machines.modelId, models.id))
  .innerJoin(locations, eq(machines.locationId, locations.id))
  .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
  .leftJoin(users, eq(issues.createdById, users.id))
  .where(eq(issues.id, id))
  .limit(1);
```

## Best Practices

1. **Always use transactions** for multi-table operations
2. **Scope by organization** in every tenant query
3. **Use prepared statements** for repeated queries
4. **Prefer specific column selection** over SELECT \*
5. **Index columns used in WHERE and JOIN** clauses

## Debugging

```typescript
// Log generated SQL
const query = db
  .select()
  .from(issues)
  .where(eq(issues.organizationId, orgId))
  .toSQL();

console.log(query.sql, query.params);

// Enable query logging
const db = drizzle(pool, {
  logger: true, // Logs all queries
});
```
