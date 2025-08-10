# Direct Conversion Migration Guide

This guide covers patterns and strategies for converting routers directly from Prisma to Drizzle without parallel validation infrastructure, optimized for solo development velocity.

## Context & Philosophy

This approach is specifically designed for PinPoint's context:

- **Solo development, pre-beta**: No production users or coordination overhead
- **High risk tolerance**: Breaking things temporarily is acceptable
- **Phase 2A foundation complete**: Solid Drizzle schema with 1:1 Prisma parity
- **Established patterns**: 3 routers already converted successfully

**Core Philosophy**: Direct conversion from Prisma to Drizzle without parallel validation infrastructure, optimized for velocity and learning.

## Migration Strategy Overview

### Phase 1: Cleanup Existing Routers (2-3 days)

Remove parallel validation infrastructure from routers that already have Drizzle implementations:

**Target Files:**

- `organization.ts` (75 lines → ~25 lines)
- `user.ts` (687 lines → ~200 lines)
- `machine.core.ts` (509 lines → ~150 lines)
- `role.ts` (minimal cleanup, preserve service pattern)

### Phase 2: Convert Remaining Routers (2-3 weeks)

Direct conversion of 13 remaining routers using enhanced drizzle-migration agent.

### Phase 3: Prisma Removal (1-2 days)

Complete removal of Prisma dependencies and cleanup.

## Conversion Patterns

### Basic Query Conversion

```typescript
// ❌ OLD: Prisma with parallel validation boilerplate
export const issueRouter = createTRPCRouter({
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // 50+ lines of parallel validation code...
      const prismaResult = await ctx.db.issue.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: { machine: true, status: true },
      });

      const drizzleResult = await ctx.drizzle
        .select({
          // Complex select object...
        })
        .from(issues)
        .leftJoin(machines, eq(issues.machineId, machines.id));
      // More validation logic...

      // Comparison and logging code...
      return prismaResult;
    }),
});

// ✅ NEW: Clean Drizzle implementation
export const issueRouter = createTRPCRouter({
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.drizzle.query.issues.findFirst({
        where: and(
          eq(issues.id, input.id),
          eq(issues.organizationId, ctx.organization.id),
        ),
        with: {
          machine: true,
          status: true,
        },
      });

      if (!issue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      return issue;
    }),
});
```

### Complex Query Conversion

```typescript
// ❌ OLD: Prisma with complex includes
const issuesWithDetails = await ctx.db.issue.findMany({
  where: { organizationId: ctx.organization.id },
  include: {
    machine: {
      include: {
        location: true,
        model: true,
      },
    },
    status: true,
    assignedTo: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    comments: {
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    },
  },
});

// ✅ NEW: Clean Drizzle with explicit joins
const issuesWithDetails = await ctx.drizzle
  .select({
    issue: issues,
    machine: machines,
    location: locations,
    model: models,
    status: issueStatuses,
    assignedTo: {
      id: users.id,
      name: users.name,
      email: users.email,
    },
  })
  .from(issues)
  .leftJoin(machines, eq(issues.machineId, machines.id))
  .leftJoin(locations, eq(machines.locationId, locations.id))
  .leftJoin(models, eq(machines.modelId, models.id))
  .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
  .leftJoin(users, eq(issues.assignedToId, users.id))
  .where(eq(issues.organizationId, ctx.organization.id));
```

### Transaction Conversion

```typescript
// ❌ OLD: Prisma transactions
const result = await ctx.db.$transaction(async (tx) => {
  const issue = await tx.issue.create({
    data: {
      title: input.title,
      machineId: input.machineId,
      organizationId: ctx.organization.id,
    },
  });

  await tx.issueHistory.create({
    data: {
      issueId: issue.id,
      type: "CREATED",
      actorId: ctx.session.user.id,
    },
  });

  return issue;
});

// ✅ NEW: Drizzle transactions
const result = await ctx.drizzle.transaction(async (tx) => {
  const [issue] = await tx
    .insert(issues)
    .values({
      title: input.title,
      machineId: input.machineId,
      organizationId: ctx.organization.id,
    })
    .returning();

  await tx.insert(issueHistory).values({
    issueId: issue.id,
    type: "CREATED",
    actorId: ctx.session.user.id,
  });

  return issue;
});
```

## Enhanced drizzle-migration Agent

### Direct Conversion Mode

The enhanced agent operates in direct conversion mode with these capabilities:

**Pre-Conversion Analysis:**

1. Read router file and understand structure
2. Identify complex operations needing special attention
3. Check organizational scoping requirements
4. Plan conversion approach

**Conversion Process:**

1. Convert procedures one-by-one within router
2. Focus on clean, direct Drizzle implementations
3. Maintain proper TypeScript types
4. Preserve essential business logic
5. Add targeted comments for complex conversions

**Quality Standards:**

- TypeScript compilation must pass
- Organizational scoping must be preserved
- Essential relationships must be maintained
- Error handling should be appropriate

### Conversion Philosophy

1. **Generate clean, idiomatic Drizzle code**
   - Use Drizzle query API when possible
   - Leverage Drizzle's type inference
   - Prefer explicit joins over complex subqueries

2. **Don't preserve awkward Prisma patterns**
   - Convert nested includes to joins
   - Simplify complex where clauses
   - Use Drizzle's relational queries

3. **Optimize for readability and maintainability**
   - Clear variable names
   - Logical query structure
   - Minimal nesting

4. **Focus on essential business logic preservation**
   - Maintain organizational scoping
   - Preserve error handling
   - Keep validation logic intact

## File-by-File Process

### 1. Preparation

```bash
# Commit current state for rollback safety
git add . && git commit -m "Pre-conversion checkpoint"

# Ensure drizzle-migration agent is ready
# Verify build passes before starting
npm run typecheck
```

### 2. Conversion

```bash
# Use enhanced drizzle-migration agent for conversion
# Agent handles: reading router, converting queries, updating types

# After conversion, validate immediately:
npm run typecheck      # TypeScript validation
npm run dev           # Manual testing
```

### 3. Validation

- Run key user flows for converted functionality
- Pay attention to complex business logic areas
- Fix issues immediately before moving to next router
- Easy rollback with `git checkout filename.ts`

### 4. Documentation

- Document conversion decisions for complex cases
- Note any behavioral changes discovered
- Keep migration notes for future reference

## Risk Management

### Acceptable Risks (Solo Dev Context)

- **Temporary functionality breaks** - fixable immediately
- **Missing edge cases** - discoverable through usage
- **Performance differences** - optimizable later
- **Query behavior differences** - addressable as found

### Risk Mitigation Strategies

**TypeScript Safety:**

- Build must pass after each conversion
- Leverage strict mode to catch errors early
- Use proper Drizzle types throughout

**Incremental Approach:**

- Convert one router at a time
- Test immediately after each conversion
- Fix issues before moving to next router

**Manual Validation:**

- Run app after each conversion
- Test key user flows for converted functionality
- Add targeted tests for discovered edge cases

## Common Conversion Challenges

### 1. Complex Includes

**Challenge**: Prisma's nested includes don't directly map to Drizzle
**Solution**: Use explicit joins or Drizzle's relational query API

### 2. Type Mismatches

**Challenge**: Prisma and Drizzle return different types
**Solution**: Update type annotations and handle differences explicitly

### 3. Query Complexity

**Challenge**: Some Prisma queries are more complex in Drizzle
**Solution**: Break down complex queries, use subqueries when needed

### 4. Transaction Patterns

**Challenge**: Different transaction syntax and return patterns
**Solution**: Update to Drizzle's transaction API and .returning() pattern

## Success Metrics

**Velocity**: Complete in 2-3 weeks vs 7+ weeks with infrastructure approach
**Code Quality**: Clean, readable Drizzle implementations  
**Learning**: Deep understanding of Drizzle patterns and capabilities
**Maintainability**: No temporary validation code to maintain

## Timeline

```
Week 1: Foundation & Cleanup
├── Days 1-2: Update drizzle-migration agent for direct conversion
├── Days 3-4: Clean up existing routers (remove parallel validation)
├── Day 5: Validation and testing of cleanup

Week 2-3: Core Conversions
├── Days 1-3: Convert simple CRUD routers (3-4 routers)
├── Days 4-8: Convert medium complexity routers (5-6 routers)
├── Days 9-12: Convert complex routers (3-4 routers)
├── Days 13-14: Final validation and testing

Week 4: Finalization (if needed)
├── Days 1-2: Prisma removal and cleanup
├── Days 3-4: Documentation and final testing
```

## Conclusion

This direct conversion approach eliminates 400+ lines of boilerplate and 3-4 weeks of infrastructure development by moving directly to clean Drizzle implementations. The file-by-file approach ensures safety through incremental progress while the enhanced migration agent provides consistency and quality.

**Ready to execute!** 🚀
