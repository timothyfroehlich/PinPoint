# Phase 3.3: tRPC Routers Service Factory Usage

## Priority: MEDIUM - CAN BE DONE IN PARALLEL WITH 3.1 and 3.2

## Dependencies

- Phase 1 and 2 must be completed first

## Objective

Update all tRPC routers to use service factory from context instead of directly instantiating services.

## Pattern to Apply

### Current Pattern (REMOVE):

```typescript
const service = new SomeService(ctx.db);
```

### New Pattern (USE):

```typescript
const service = ctx.services.createSomeService();
```

## Files to Modify

### Service Usage Inventory

Based on grep results, these routers instantiate services:

1. **NotificationService** (4 instances)
   - `src/server/api/routers/notification.ts`
   - `src/server/api/routers/issue.core.ts` (2 instances)

2. **CollectionService** (7 instances)
   - `src/server/api/routers/collection.ts`

3. **PinballMapService** (4 instances)
   - `src/server/api/routers/pinballMap.ts`

4. **IssueActivityService** (4 instances)
   - `src/server/api/routers/issue.timeline.ts`
   - `src/server/api/routers/issue.core.ts` (2 instances)
   - `src/server/api/routers/issue.comment.ts`
   - `src/server/api/routers/comment.ts`

5. **CommentCleanupService** (5 instances)
   - `src/server/api/routers/comment.ts` (4 instances)
   - `src/server/api/routers/issue.admin.ts`

6. **QRCodeService** (NEW - check usage)
   - `src/server/api/routers/qrCode.ts`

## Implementation Steps

### 1. Update Each Router File

For each file listed above:

- Find all `new ServiceName(ctx.db)` instances
- Replace with `ctx.services.createServiceName()`
- Ensure imports are updated if needed

### 2. Example Transformation

**Before:**

```typescript
import { NotificationService } from "~/server/services/notificationService";

export const notificationRouter = createTRPCRouter({
  create: protectedProcedure.input(schema).mutation(async ({ ctx, input }) => {
    const service = new NotificationService(ctx.db);
    return service.createNotification(input);
  }),
});
```

**After:**

```typescript
// Remove service import if not used for types

export const notificationRouter = createTRPCRouter({
  create: protectedProcedure.input(schema).mutation(async ({ ctx, input }) => {
    const service = ctx.services.createNotificationService();
    return service.createNotification(input);
  }),
});
```

### 3. Type Safety

Ensure TypeScript properly infers service types from factory methods. The context should include:

```typescript
interface Context {
  // ... existing context
  services: ServiceFactory;
}
```

## Testing Requirements

1. All routers compile without errors
2. Service methods are called correctly
3. Type inference works properly
4. Integration tests pass

## Special Considerations

- Some routers may import services just for types - these imports can remain
- Watch for any custom service instantiation patterns
- Ensure error handling remains intact

## Acceptance Criteria

- [ ] All service instantiations use factory
- [ ] No `new Service(ctx.db)` patterns remain
- [ ] TypeScript compilation succeeds
- [ ] All router tests pass
- [ ] Manual testing of affected endpoints
