# Drizzle Migration Refactoring Plan

## Eliminating Code Duplication Through Modern 2025 Patterns

**Created:** 2025-01-09  
**Status:** Proposed  
**Target:** Phase 2B Router Migration Optimization

---

## Executive Summary

**Problem Identified:** Extensive code duplication across migrated routers with **35 parallel validation blocks**, **10 manual comparison functions**, and **~400 lines of repeated boilerplate** across 5 files.

**Solution:** Implement 2025 Drizzle + tRPC patterns with query builders, validation services, and migration utilities to reduce duplication by ~70% while improving maintainability and developer experience.

---

## Analysis Results

### Current Duplication Scope

- **user.ts**: 687 lines with ~15 parallel validation blocks
- **organization.ts**: 75 lines with 2 parallel validation blocks
- **role.ts**: 384 lines with roleService already showing good patterns
- **machine.core.ts**: 509 lines with 17 parallel validation blocks
- **issueStatus.ts**: Previously migrated with similar patterns

### Pattern Analysis

Every procedure currently follows this duplicated pattern:

```typescript
// Prepare update data (same logic for both ORMs)
const updateData = {
  /* ... */
};

// Execute Prisma query (current implementation)
const prismaResult = await ctx.db.entity.operation(/* ... */);

// Execute Drizzle query (new implementation)
const drizzleResult = await ctx.drizzle.operation(/* ... */);

// Validation: Ensure both queries return equivalent results
if (!drizzleResult) {
  throw new Error("Operation failed - no result returned from Drizzle");
}

// Compare critical fields to ensure parity
if (prismaResult.field !== drizzleResult.field /* ... */) {
  console.error("MIGRATION WARNING: Prisma and Drizzle results differ", {
    prisma: prismaResult,
    drizzle: drizzleResult,
  });
}

// Return Prisma result to maintain current behavior during parallel validation
return prismaResult;
```

This pattern appears **35 times** with minor variations, indicating perfect candidates for abstraction.

---

## Implementation Plan

### Phase 1: Foundation Infrastructure (Week 1, Days 1-3)

#### 1.1 Migration Validation Service

**File:** `src/server/services/migrationValidationService.ts`

```typescript
export class MigrationValidationService {
  async validateQuery<T>(
    name: string,
    prismaQuery: () => Promise<T>,
    drizzleQuery: () => Promise<T>,
    options: {
      compareFields?: (keyof T)[];
      skipInProduction?: boolean;
      logLevel?: "error" | "warn" | "info";
    } = {},
  ): Promise<T> {
    // Implementation with environment-based switching
    // Type-safe field comparison
    // Structured logging
  }

  async validateMutation<T>(/* similar but for mutations */): Promise<T>;
  async validateCount(/* specialized for count operations */): Promise<number>;
}
```

#### 1.2 Query Builder Factories

**Directory:** `src/server/db/queryBuilders/`

**Base:** `EntityQueryBuilder.ts`

```typescript
export abstract class EntityQueryBuilder<TEntity, TPrismaModel> {
  constructor(
    protected prisma: ExtendedPrismaClient,
    protected drizzle: DrizzleClient,
    protected organizationId: string,
    protected validator: MigrationValidationService,
  ) {}

  abstract getById(id: string): Promise<TEntity | null>;
  abstract create(data: Partial<TEntity>): Promise<TEntity>;
  abstract update(id: string, data: Partial<TEntity>): Promise<TEntity>;
  abstract delete(id: string): Promise<void>;
}
```

**Specific Builders:**

- `UserQueryBuilder.ts` - User operations with complex count aggregations
- `OrganizationQueryBuilder.ts` - Simple CRUD operations
- `RoleQueryBuilder.ts` - Permission relationships and system role logic
- `MachineQueryBuilder.ts` - Model/location validation patterns

#### 1.3 Count Aggregation Helpers

**File:** `src/server/db/drizzle/countHelpers.ts`

```typescript
// Leverage 2025 Drizzle patterns
export const countHelpers = {
  async userActivityCounts(
    db: DrizzleClient,
    userIds: string[],
  ): Promise<Map<string, UserCounts>> {
    // Batch count operations using inArray and groupBy
    // Replace verbose individual count queries
  },

  async issueStatusCounts(
    db: DrizzleClient,
    organizationId: string,
  ): Promise<StatusCount[]> {
    // Use sql template for efficient aggregations
  },
};
```

#### 1.4 tRPC Migration Middleware

**File:** `src/server/api/middleware/dualORM.ts`

```typescript
export const dualORMMiddleware = experimental_standaloneMiddleware<{
  ctx: { db: ExtendedPrismaClient; drizzle: DrizzleClient };
}>().create(async (opts) => {
  const migrationValidator = new MigrationValidationService();
  const useDroppize = process.env.USE_DRIZZLE === "true";

  return opts.next({
    ctx: {
      ...opts.ctx,
      queryMode: useDroppize ? "drizzle" : "prisma",
      validator: migrationValidator,
      queryBuilders: {
        user: new UserQueryBuilder(
          opts.ctx.db,
          opts.ctx.drizzle,
          opts.ctx.organization.id,
          migrationValidator,
        ),
        organization: new OrganizationQueryBuilder(/* ... */),
        // ... other builders
      },
    },
  });
});
```

### Phase 2: Documentation Update (Week 1, Days 4-5)

#### 2.1 Update Migration Documentation

**Files to Update:**

- `docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md`
- `docs/developer-guides/drizzle/migration-utilities.md` (new)
- `docs/testing/drizzle-router-testing-guide.md`

**New Content:**

- Query builder usage patterns
- Validation service configuration
- Count helper examples
- Migration middleware setup

#### 2.2 Update Drizzle Migration Agent

**File:** `.claude/agents/drizzle-migration.md`

**Key Changes:**

1. **Self-Discovery Protocol** - Add migration utilities documentation
2. **Migration Workflow** - Replace manual dual-ORM with utility-based approach
3. **Conversion Examples** - Show query builder patterns
4. **Completion Report** - Reflect utility usage instead of manual validation

**New Sections:**

```markdown
### 2.5 Check Migration Utilities

- Confirm `MigrationValidationService` is available in context
- Check for entity-specific query builders
- Verify count helpers for aggregation operations
- Ensure middleware provides proper abstractions

### Phase 2: Utility-Based Conversion

1. **Use query builders** instead of manual dual-ORM validation
2. **Leverage validation service** for result comparison
3. **Apply count helpers** for aggregation operations
4. **Maintain organizationId filtering** through builder patterns
5. **Use proper TypeScript types** from utility abstractions
```

**Updated Conversion Examples:**

```typescript
// Old Manual Pattern (AVOID)
const prismaResult = await ctx.db.user.findUnique(/* ... */);
const drizzleResult = await ctx.drizzle.select(/* ... */);
// ... manual validation logic

// New Utility Pattern (PREFERRED)
const result = await ctx.queryBuilders.user.getById(userId);
```

### Phase 3: Pilot Refactor (Week 2, Days 1-2)

#### 3.1 organization.ts Refactor (Pilot)

**Why organization.ts first:**

- Simplest router (75 lines, 1 mutation)
- Single entity type
- Clear success criteria
- Fast validation of utility patterns

**Expected Outcome:**

- Reduce from 75 → ~25 lines
- Remove all manual validation boilerplate
- Validate utility integration
- Document lessons learned

#### 3.2 Lessons Learned Documentation

After pilot refactor, update:

- Utility usage patterns that worked well
- Issues encountered and solutions
- Performance characteristics observed
- Developer experience improvements
- Additional utilities needed

### Phase 4: Primary Refactors (Week 2, Days 3-5)

#### 4.1 user.ts Refactor (Highest Impact)

**Complexity:** High (687 lines, 15 validation blocks)
**Expected Reduction:** 687 → ~200 lines (~70% reduction)

**Key Patterns to Abstract:**

- Complex count aggregations in `getAllInOrganization`
- Profile picture upload with validation
- User lookup with organization membership verification
- Batch count operations for multiple entities

#### 4.2 machine.core.ts Refactor

**Complexity:** High (509 lines, 17 validation blocks)
**Expected Reduction:** 509 → ~150 lines (~70% reduction)

**Key Patterns to Abstract:**

- Model/location validation patterns
- Complex joins with includes
- Machine creation workflow
- Count aggregations with grouping

#### 4.3 role.ts Integration

**Complexity:** Medium (existing patterns already good)
**Focus:** Integrate roleService with new query builders
**Expected Benefit:** Consistency with utility patterns

### Phase 5: Documentation Refinement (Week 3, Day 1)

#### 5.1 Update Documentation with Lessons Learned

- Real-world utility usage examples
- Performance benchmarks from refactors
- Common patterns and anti-patterns identified
- Troubleshooting guide for migration utilities

#### 5.2 Create Developer Guide

**File:** `docs/developer-guides/drizzle/migration-utilities.md`

- How to use query builders effectively
- When to create new utilities vs use existing ones
- Testing strategies with utilities
- Performance optimization tips

### Phase 6: Remaining Router Migrations (Week 3-4)

#### 6.1 Apply Refined Patterns to 13 Remaining Routers

Using proven utility patterns:

- No manual parallel validation needed
- Consistent query builder usage
- Standardized error handling
- Type-safe operations

#### 6.2 Progressive Prisma Removal

- Feature flags for per-entity ORM selection
- Gradual validation removal in production
- Performance monitoring and optimization

---

## Expected Outcomes

### Code Quality Improvements

- **70% reduction** in duplicated validation code (~400 lines removed)
- **Consistent patterns** across all routers
- **Type safety** through utility abstractions
- **Better error handling** with centralized validation

### Developer Experience

- **New routers** use simple, documented patterns
- **No boilerplate** for dual-ORM validation
- **IDE-friendly** query builder APIs
- **Comprehensive documentation** with real examples

### Performance Benefits

- **Batch operations** reduce N+1 query problems
- **2025 Drizzle patterns** (~3x faster aggregations with `$count()`)
- **Lateral join optimizations** for complex relationships
- **Reduced memory usage** from eliminated duplication

### Risk Mitigation

- **Pilot refactor approach** validates utilities before large changes
- **Gradual migration** with feature flags
- **Parallel validation** maintained during transition
- **Easy rollback** through environment variables

---

## Migration Timeline

```
Week 1: Foundation & Documentation
├── Days 1-3: Create utilities (validation service, query builders, helpers)
├── Days 4-5: Update documentation and drizzle-migration agent

Week 2: Pilot & Primary Refactors
├── Days 1-2: organization.ts pilot refactor + lessons learned
├── Days 3-5: user.ts and machine.core.ts refactors

Week 3: Refinement & Remaining Routers
├── Day 1: Documentation refinement with lessons learned
├── Days 2-5: Apply patterns to remaining 13 routers

Week 4: Optimization & Cleanup
├── Days 1-2: Performance optimization and Prisma removal prep
├── Days 3-5: Final cleanup and documentation
```

**Total Timeline:** 3-4 weeks  
**Risk Level:** Low (pilot-first approach with rollback capabilities)

---

## Success Criteria

### Code Metrics

- [ ] Reduce duplicate validation code by >65%
- [ ] All routers use standardized query patterns
- [ ] Zero TypeScript/ESLint errors
- [ ] All tests pass with utility-based patterns

### Documentation

- [ ] Updated migration documentation reflects utility patterns
- [ ] Drizzle-migration agent updated with new workflows
- [ ] Developer guide created with real examples
- [ ] Lessons learned documented for future migrations

### Performance

- [ ] Count aggregations perform ≥3x faster with new helpers
- [ ] No regression in query performance
- [ ] Reduced memory usage from eliminated duplication

### Developer Experience

- [ ] New router migrations use simple query builder patterns
- [ ] No manual dual-ORM validation required
- [ ] Clear error messages and debugging capabilities

---

## Agent Integration Strategy

The updated `drizzle-migration` agent will:

1. **Always check for utilities first** before starting manual conversion
2. **Use query builders** as the primary conversion approach
3. **Leverage validation service** instead of writing manual comparison logic
4. **Reference count helpers** for aggregation operations
5. **Update completion reports** to reflect utility-based approach
6. **Hand off to test-architect** with utility-aware test requirements

This creates a **feedback loop**: utilities → documentation → agent updates → better migrations → improved utilities.

---

## Ready to Proceed?

This plan provides a systematic approach to eliminate the identified code duplication while establishing modern 2025 patterns for the remaining Phase 2B-E router migrations. The pilot-first approach ensures utilities are proven before large-scale application.

**Next Step:** Approve plan and begin Phase 1 utility creation.
