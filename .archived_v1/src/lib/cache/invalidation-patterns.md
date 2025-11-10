# React 19 Cache Invalidation Patterns

_Comprehensive guide to cache invalidation strategies in PinPoint's Server Actions_
_Phase 4D: Server Action Cache Invalidation Implementation_

## Overview

PinPoint implements comprehensive cache invalidation using Next.js 15's `revalidatePath()` and `revalidateTag()` APIs to ensure React 19 cache() patterns work effectively across all mutations.

## Core Invalidation Strategy

### 1. **Path-Based Invalidation**

Used for specific pages that need to refresh after mutations:

```typescript
// Specific issue page
revalidatePath(`/issues/${issueId}`);

// All issues list
revalidatePath("/issues");

// Dashboard statistics
revalidatePath("/dashboard");
```

### 2. **Tag-Based Invalidation**

Used for semantic cache groups that span multiple pages:

```typescript
// All issue-related caches
revalidateTag("issues");

// Specific issue's comments
revalidateTag(`comments-${issueId}`);

// Organization-scoped recent comments
revalidateTag(`recent-comments-${organizationId}`);
```

## Invalidation Patterns by Entity

### Issues System

**Issue Creation/Updates:**

```typescript
// In createIssueAction, updateIssueStatusAction, etc.
revalidatePath("/issues"); // Issues list page
revalidatePath(`/issues/${issueId}`); // Specific issue page
revalidatePath("/dashboard"); // Dashboard stats
revalidateTag("issues"); // All issue caches
```

**Comments:**

```typescript
// In addCommentAction, editCommentAction, deleteCommentAction
revalidatePath(`/issues/${issueId}`); // Issue detail page
revalidateTag("issues"); // General issue caches
revalidateTag(`comments-${issueId}`); // Issue-specific comments
revalidateTag(`recent-comments-${organizationId}`); // Org activity feeds
```

### Organizations System

**Organization Updates:**

```typescript
// In updateOrganizationAction
revalidatePath("/dashboard"); // Dashboard with org info
revalidatePath("/settings/organization"); // Settings page
revalidateTag(`organization-${organizationId}`);
```

### Cache Tag Naming Conventions

| Pattern               | Usage                  | Example                     |
| --------------------- | ---------------------- | --------------------------- |
| `entity-type`         | Global entity caches   | `"issues"`, `"machines"`    |
| `entity-id`           | Specific entity caches | `"comments-issue-123"`      |
| `entity-scope-id`     | Scoped entity caches   | `"recent-comments-org-456"` |
| `entity-relationship` | Related data caches    | `"issue-assignments"`       |

## Performance Optimizations

### 1. **Granular Invalidation**

- Only invalidate specific caches that are affected
- Use specific tags rather than broad invalidation
- Combine path and tag invalidation for complete coverage

### 2. **Organization Scoping**

- Always scope cache tags by organization for multi-tenancy
- Prevents cross-organization cache pollution
- Improves cache hit rates for organization-specific data

### 3. **Background Processing**

- Use `runAfterResponse()` for non-critical invalidation
- Cache invalidation runs before response for critical UI updates
- Background notifications don't delay user feedback

## Implementation Examples

### Basic Server Action with Cache Invalidation

```typescript
export async function updateEntityAction(
  entityId: string,
  _prevState: ActionResult<any> | null,
  formData: FormData,
): Promise<ActionResult<any>> {
  try {
    const { user, organizationId } = await getActionAuthContext();

    // Validate and process mutation
    const validation = validateFormData(formData, schema);
    if (!validation.success) {
      return validation;
    }

    // Database mutation
    await db
      .update(entities)
      .set(updateData)
      .where(
        and(
          eq(entities.id, entityId),
          eq(entities.organization_id, organizationId),
        ),
      );

    // CRITICAL: Cache invalidation immediately after mutation
    revalidatePath(`/entities/${entityId}`); // Specific entity page
    revalidatePath("/entities"); // Entity list pages
    revalidatePath("/dashboard"); // Dashboard stats
    revalidateTag("entities"); // All entity caches
    revalidateTag(`entity-${entityId}`); // Entity-specific caches

    return actionSuccess(data, "Updated successfully");
  } catch (error) {
    return actionError("Update failed");
  }
}
```

### Advanced Multi-Entity Invalidation

```typescript
export async function bulkUpdateAction(formData: FormData) {
  // ... validation and mutation logic

  // Bulk invalidation for multiple entities
  revalidatePath("/entities"); // List pages
  revalidatePath("/dashboard"); // Stats pages
  revalidateTag("entities"); // General caches

  // Individual entity invalidation
  updatedEntities.forEach((entity) => {
    revalidatePath(`/entities/${entity.id}`);
    revalidateTag(`entity-${entity.id}`);
  });

  // Related entity invalidation
  revalidateTag(`entity-assignments-${organizationId}`);
  revalidateTag(`recent-activity-${organizationId}`);
}
```

## Cache Verification

### Development Testing

Use the cache debug tools to verify invalidation effectiveness:

```bash
# Access cache test page (development only)
http://localhost:3000/dev/cache-test

# Monitor cache statistics
# Check browser console for cache hit/miss logs
# Use floating debug panel for real-time statistics
```

### Debug Cache Invalidation

```typescript
// Add to Server Actions for debugging
console.log(`Invalidating caches for ${entityType}:${entityId}`);
revalidatePath(`/entities/${entityId}`);
revalidateTag(`entity-${entityId}`);
console.log(`Cache invalidation complete`);
```

## Best Practices

### ✅ Do:

- **Invalidate immediately** after successful mutations
- **Use specific tags** for granular control
- **Combine path + tag** invalidation for complete coverage
- **Scope by organization** for multi-tenant applications
- **Test invalidation** with debug tools during development

### ❌ Don't:

- **Over-invalidate** with broad tags like "all-data"
- **Forget background invalidation** for related entities
- **Skip error handling** in invalidation logic
- **Mix sync/async** invalidation patterns inconsistently
- **Invalidate before** confirming successful mutation

## Monitoring & Debugging

### Production Monitoring

- Track cache hit rates via application metrics
- Monitor database query counts after invalidation
- Alert on excessive cache misses

### Development Tools

- Use `/dev/cache-test` page for testing invalidation
- Check browser console for cache logs
- Utilize floating debug panel for real-time stats

## Related Patterns

- **React 19 cache()**: Request-level memoization in DAL functions
- **Server Actions**: Mutations with automatic invalidation
- **Server Components**: Auto-refresh on cache invalidation
- **Background Processing**: Async invalidation for non-critical updates

---

## Implementation Status: ✅ COMPLETE

All Server Actions in PinPoint implement comprehensive cache invalidation:

- Issues System: Full path + tag invalidation
- Comments System: Granular comment-specific invalidation
- Organizations: Multi-scope invalidation patterns
- Debug Tools: Development verification utilities

Cache invalidation is working effectively across the entire Issues System modernization.
