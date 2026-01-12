# Service Layer Transaction Pattern

**Status**: Established Pattern
**Version**: 1.0
**Last Updated**: January 10, 2026

---

## Overview

Consistent structure for service layer functions that perform database updates with transactions, timeline events, and notifications.

## Pattern Structure

```typescript
import { db } from "~/server/db";
import { createTimelineEvent } from "~/lib/timeline/events";
import { createNotification } from "~/lib/notifications";
import { log } from "~/lib/logger";

export async function updateSomething({
  id,
  newValue,
  userId,
}: {
  id: string;
  newValue: string;
  userId: string;
}): Promise<{ id: string; oldValue: string; newValue: string }> {
  return await db.transaction(async (tx) => {
    // 1. Get current state (with needed relations)
    const current = await tx.query.myTable.findFirst({
      where: eq(myTable.id, id),
      columns: { value: true /* other needed fields */ },
      with: { relatedEntity: true },
    });

    if (!current) {
      throw new Error("Entity not found");
    }

    const oldValue = current.value;

    // 2. Perform update
    await tx
      .update(myTable)
      .set({
        value: newValue,
        updatedAt: new Date(),
      })
      .where(eq(myTable.id, id));

    // 3. Create timeline event (inside transaction for atomicity)
    await createTimelineEvent(
      id,
      `Value changed from ${oldValue} to ${newValue}`,
      tx
    );

    // 4. Structured logging
    log.info(
      {
        id,
        oldValue,
        newValue,
        userId,
        action: "updateSomething",
      },
      "Entity value updated"
    );

    // 5. Trigger notifications (with error handling)
    try {
      await createNotification(
        {
          type: "value_changed",
          resourceId: id,
          resourceType: "entity",
          actorId: userId,
          // ... notification metadata ...
        },
        tx
      );
    } catch (error) {
      log.error(
        { error, action: "updateSomething.notifications" },
        "Failed to send notification"
      );
      // Don't fail the transaction if notifications fail
    }

    // 6. Return explicit result
    return { id, oldValue, newValue };
  });
}
```

## Key Principles

### 1. Transaction Boundaries

**✅ Inside Transaction**:

- Database updates
- Timeline events (for atomicity)
- Related entity updates

**✅ Outside Transaction** (or with error handling):

- External notifications (email, webhooks)
- Non-critical side effects
- Cache invalidation

### 2. Timeline Events

Always create timeline events for audit trails:

```typescript
await createTimelineEvent(
  entityId,
  `Human-readable description of change`,
  tx // Pass transaction for atomicity
);
```

### 3. Notification Error Handling

Notifications should never cause transaction rollback:

```typescript
try {
  await createNotification(/*...*/);
} catch (error) {
  log.error(
    { error, action: "functionName.notifications" },
    "Failed to send notification"
  );
  // Don't re-throw - let transaction complete
}
```

### 4. Structured Logging

Use consistent log structure:

```typescript
log.info(
  {
    entityId,
    oldValue,
    newValue,
    userId,
    action: "functionName", // Consistent naming
  },
  "Human-readable summary"
);
```

### 5. Explicit Return Types

Always specify return type for clarity:

```typescript
export async function updateSomething({...}): Promise<{
  entityId: string;
  oldValue: string;
  newValue: string;
}> {
  // ...
}
```

## Real-World Examples

### Update Issue Status

[src/services/issues.ts:212-299](file:///home/froeht/Code/PinPoint/src/services/issues.ts#L212-L299)

```typescript
export async function updateIssueStatus({
  issueId,
  status,
  userId,
}: UpdateIssueStatusParams): Promise<{
  issueId: string;
  oldStatus: string;
  newStatus: string;
}> {
  return await db.transaction(async (tx) => {
    // Get current state
    const currentIssue = await tx.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: { machine: true },
    });

    if (!currentIssue) throw new Error("Issue not found");

    const oldStatus = currentIssue.status;
    const isClosed = CLOSED_STATUSES.includes(status);

    // Update
    await tx
      .update(issues)
      .set({
        status,
        updatedAt: new Date(),
        closedAt: isClosed ? new Date() : null,
      })
      .where(eq(issues.id, issueId));

    // Timeline event
    const oldLabel = getIssueStatusLabel(oldStatus);
    const newLabel = getIssueStatusLabel(status);
    await createTimelineEvent(
      issueId,
      `Status changed from ${oldLabel} to ${newLabel}`,
      tx
    );

    // Logging
    log.info({ issueId, oldStatus, newStatus: status }, "Issue status updated");

    // Notifications (with error handling)
    try {
      await createNotification(
        {
          /*...*/
        },
        tx
      );
    } catch (error) {
      log.error({ error }, "Failed to send notification");
    }

    return { issueId, oldStatus, newStatus: status };
  });
}
```

### Create Issue with Auto-Watchers

[src/services/issues.ts:84-206](file:///home/froeht/Code/PinPoint/src/services/issues.ts#L84-L206)

Demonstrates:

- Sequential number generation (atomic)
- Multiple insert operations
- Conditional watcher logic
- Notification creation

## Anti-Patterns

### ❌ Missing Transaction

```typescript
// BAD: No transaction, non-atomic
export async function updateValue(id, newValue) {
  await db.update(myTable).set({ value: newValue });
  await createTimelineEvent(id, "changed"); // Could fail after update
}
```

### ❌ Failing on Notification Error

```typescript
// BAD: Notification failure causes rollback
export async function updateValue(id, newValue) {
  return await db.transaction(async (tx) => {
    await tx.update(myTable).set({ value: newValue });
    await createNotification({
      /*...*/
    }); // If this fails, update rolls back
  });
}
```

### ❌ Missing Logging

```typescript
// BAD: No audit trail
export async function updateValue(id, newValue) {
  return await db.transaction(async (tx) => {
    await tx.update(myTable).set({ value: newValue });
    // No log.info() - hard to debug issues
  });
}
```

### ❌ Implicit Return Type

```typescript
// BAD: Return type unclear
export async function updateValue(id, newValue) {
  return await db.transaction(async (tx) => {
    const result = await tx.update(/*...*/).returning();
    return result[0]; // What shape is this?
  });
}
```

## Checklist

Use this checklist for all service layer update functions:

- [ ] Wrapped in `db.transaction()`
- [ ] Current state fetched within transaction
- [ ] Null/error checks for entity not found
- [ ] Update operation performed
- [ ] Timeline event created (inside transaction)
- [ ] Structured logging added
- [ ] Notifications wrapped in try/catch
- [ ] Explicit return type specified
- [ ] Integration test written

## Related Patterns

- [Server Actions with Error Handling](./mutations.md#error-handling)
- [Timeline Events](./timeline-events.md)
- [Structured Logging](./logging.md)
- [Integration Testing](./testing-patterns.md#integration-tests)

## References

- [src/services/issues.ts](file:///home/froeht/Code/PinPoint/src/services/issues.ts) - Full implementation
- [CORE-PERF-001](file:///home/froeht/Code/PinPoint/docs/NON_NEGOTIABLES.md#performance--caching) - Cache service fetchers
- [Drizzle Transactions Docs](https://orm.drizzle.team/docs/transactions)
