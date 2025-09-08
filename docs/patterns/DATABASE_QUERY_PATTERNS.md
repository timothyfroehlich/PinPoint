# Database Query Patterns

**Status**: Proven patterns ready for copying  
**Purpose**: Consistent database access patterns for multi-tenant security and performance

## Core Patterns

### 1. Organization-Scoped Query Pattern

**When to use**: Every multi-tenant database query  
**Security**: Ensures data isolation between organizations

```typescript
import { cache } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "~/lib/dal/shared";
import { withOrgRLS } from "~/lib/organization-context";

export const getEntityByOrg = cache(async (organizationId: string, filters?: EntityFilters) => {
  return withOrgRLS(db, organizationId, async (tx) => {
    return await tx.query.entities.findMany({
      where: eq(entities.organization_id, organizationId),
      // Additional filters here
    });
  });
});
```

### 2. Paginated Query with Filtering Pattern

**When to use**: List views with search, filters, and pagination  
**Features**: Type-safe filtering, count queries, "has next page" logic

```typescript
import { sql, SQL } from "drizzle-orm";

export const getPaginatedEntities = cache(async (
  organizationId: string,
  filters: EntityFilters,
  pagination: PaginationOptions,
  sorting: SortingOptions
) => {
  return withOrgRLS(db, organizationId, async (tx) => {
    // Build where conditions
    const whereConditions: SQL[] = [eq(entities.organization_id, organizationId)];
    
    if (filters.status?.length) {
      whereConditions.push(inArray(entities.status_id, filters.status));
    }
    
    if (filters.search) {
      whereConditions.push(
        or(
          ilike(entities.title, `%${filters.search}%`),
          ilike(entities.description, `%${filters.search}%`)
        )
      );
    }

    // Count query for pagination
    const totalCountResult = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(entities)
      .where(and(...whereConditions));
    const totalCount = safeCount(totalCountResult);

    // Main query with limit + 1 for hasNext detection
    const offset = (pagination.page - 1) * pagination.limit;
    const results = await tx.query.entities.findMany({
      where: and(...whereConditions),
      limit: pagination.limit + 1,
      offset,
      orderBy: [desc(entities.created_at)], // or sorting logic
    });

    const hasNext = results.length > pagination.limit;
    if (hasNext) results.pop();

    return {
      data: results,
      pagination: {
        totalCount,
        hasNext,
        page: pagination.page,
        limit: pagination.limit,
      },
    };
  });
});
```

### 3. Entity with Relationships Pattern

**When to use**: Details views requiring related data  
**Performance**: Efficient single query with joins

```typescript
export const getEntityWithDetails = cache(async (
  organizationId: string,
  entityId: string
) => {
  return withOrgRLS(db, organizationId, async (tx) => {
    return await tx.query.entities.findFirst({
      where: and(
        eq(entities.id, entityId),
        eq(entities.organization_id, organizationId)
      ),
      with: {
        // Standard relationship patterns
        assignedTo: {
          columns: { id: true, name: true, email: true }
        },
        status: {
          columns: { id: true, name: true, category: true }
        },
        createdBy: {
          columns: { id: true, name: true, email: true }
        },
      },
    });
  });
});
```

### 4. Server Action Database Pattern

**When to use**: Forms and mutations in Server Actions  
**Features**: Auth validation, error handling, cache invalidation

```typescript
import { revalidatePath } from "next/cache";
import { getActionAuthContext } from "~/lib/actions/shared";

export async function updateEntity(formData: FormData) {
  const { organizationId } = await getActionAuthContext();
  
  const entityId = formData.get("entityId") as string;
  const updates = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
  };

  await db
    .update(entities)
    .set(updates)
    .where(and(
      eq(entities.id, entityId),
      eq(entities.organization_id, organizationId)
    ));

  revalidatePath("/entities");
}
```

## Security Requirements

### ✅ Always Include Organization Scoping
```typescript
// ✅ Correct
where: and(
  eq(entities.id, entityId),
  eq(entities.organization_id, organizationId)
)

// ❌ Dangerous - missing org scoping
where: eq(entities.id, entityId)
```

### ✅ Use withOrgRLS Wrapper
```typescript
// ✅ Correct - RLS enforced
return withOrgRLS(db, organizationId, async (tx) => {
  return await tx.query.entities.findMany({...});
});

// ❌ Risky - no RLS enforcement
return await db.query.entities.findMany({...});
```

## Performance Requirements

### ✅ Cache All Data Fetchers
```typescript
// ✅ Correct - prevents duplicate queries
export const getEntities = cache(async (organizationId: string) => {
  // query logic
});

// ❌ Inefficient - will re-query on every call
export async function getEntities(organizationId: string) {
  // query logic
}
```

### ✅ Use Limit + 1 for Pagination
```typescript
// ✅ Correct - efficient "has next" detection
const results = await tx.query.entities.findMany({
  limit: pagination.limit + 1,
  // ...
});
const hasNext = results.length > pagination.limit;

// ❌ Inefficient - requires separate count query
const hasNext = totalCount > (page * limit);
```

## Copy-Paste Guidelines

1. **Start with the closest pattern** above
2. **Replace `entities` with your table name**
3. **Keep the organization scoping** - never remove it
4. **Keep the React 19 cache wrapper**
5. **Keep the withOrgRLS wrapper**
6. **Adjust the relationship `with` clauses** for your needs
7. **Update the revalidation paths** for your feature

## Pattern Evolution

When patterns need to change:
1. **Update this document first**
2. **Consider impact on existing queries**
3. **Update patterns gradually** - no rush
4. **Prioritize security consistency** over feature consistency

The current patterns work well - copy them consistently rather than reinventing.