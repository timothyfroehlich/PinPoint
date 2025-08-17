# 🚀 Unified Migration Plan: Final Prisma Removal & RLS Implementation

**Created:** 2025-08-17  
**Status:** Ready for Execution  
**Timeline:** 7-9 days total  
**Context:** Solo development, pre-beta, direct conversion approach

---

## 📋 Executive Summary

**Strategic Decision**: Implement Row Level Security (RLS) while completing Prisma removal, solving both the migration and test architecture crisis in one coordinated effort.

**Why This Approach**:

- **Same Timeline**: RLS (4-5 days) vs fixing symptoms (3-4 days) - marginal difference
- **Permanent Solution**: Eliminates organizationId management forever vs temporary fixes
- **Simplified Testing**: Tests become trivial with RLS session context
- **Industry Standard**: Database-level multi-tenancy is 2025 best practice
- **Clean Architecture**: Remove 1000+ lines of organizational filtering code

**Key Outcomes**:

1. Complete Prisma removal (service layer + infrastructure)
2. Implement RLS for automatic multi-tenancy
3. Fix 306 failing tests through architectural improvement
4. Establish standardized testing archetypes
5. Dramatically simplified codebase

---

## 🎯 Implementation Phases

### **Phase 1: Complete Prisma Service Layer Removal (Days 1-2)**

**Objective**: Finish the remaining 15% of migration by converting service layer to Drizzle

#### Day 1: Service Layer Conversion

**Morning (4 hours)**:

```typescript
// Convert remaining services to Drizzle-only
- [ ] roleService.ts - Update constructor, remove Prisma client
- [ ] permissionService.ts - Critical security service conversion
- [ ] collectionService.ts - Business logic preservation
- [ ] issueActivityService.ts - Event tracking conversion
```

**Afternoon (4 hours)**:

```typescript
// Update tRPC context to single Drizzle client
- [ ] Remove dual-ORM from context type definitions
- [ ] Update all routers: ctx.db instead of ctx.drizzle
- [ ] Remove Prisma client initialization
- [ ] Update service instantiation patterns
```

#### Day 2: Infrastructure Cleanup

**Morning (4 hours)**:

```bash
# Remove Prisma dependencies
- [ ] npm uninstall prisma @prisma/client
- [ ] Delete prisma/ directory
- [ ] Remove all Prisma imports
- [ ] Update environment variables
```

**Afternoon (4 hours)**:

```typescript
// Update test infrastructure for Drizzle-only
- [ ] Convert service test mocks to Drizzle patterns
- [ ] Update integration test context creation
- [ ] Remove Prisma-specific test utilities
- [ ] Verify TypeScript compilation passes
```

**Validation Checkpoint**:

- ✅ Zero Prisma references in codebase
- ✅ All services using Drizzle
- ✅ TypeScript compilation successful

---

### **Phase 2: RLS Foundation Implementation (Days 3-4)**

**Objective**: Implement Row Level Security policies for automatic multi-tenancy

#### Day 3: Database Policy Creation

**Morning (4 hours)**:

```sql
-- Core RLS policy implementation
- [ ] Enable RLS on all multi-tenant tables
- [ ] Create organization isolation policies
- [ ] Add default organization column values
- [ ] Test policies with manual SQL
```

**Implementation Script**:

```sql
-- Enable RLS on core tables
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Create universal organization isolation policy
CREATE POLICY org_isolation ON issues
  FOR ALL TO authenticated
  USING (organization_id = current_setting('app.current_organization_id')::text)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::text);

-- Repeat for all tables...
```

**Afternoon (4 hours)**:

```typescript
// Update database connection for RLS support
- [ ] Modify Drizzle connection to support session variables
- [ ] Create RLS session management utilities
- [ ] Test session context setting
- [ ] Verify policy enforcement
```

#### Day 4: Application Integration

**Morning (4 hours)**:

```typescript
// Simplify tRPC middleware with RLS
export const organizationProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Set RLS session context
  await ctx.db.execute(
    sql`SET app.current_organization_id = ${ctx.user.organizationId}`
  );
  return next({ ctx });
});

- [ ] Update all procedure middlewares
- [ ] Remove manual organizationId filtering
- [ ] Simplify query patterns
```

**Afternoon (4 hours)**:

```typescript
// Remove organizationId from application queries
- [ ] Update all router queries to remove manual filtering
- [ ] Simplify insert operations (no organizationId needed)
- [ ] Update service methods for RLS patterns
- [ ] Test core user flows
```

**Validation Checkpoint**:

- ✅ RLS policies active on all tables
- ✅ Session context management working
- ✅ Queries automatically org-scoped

---

### **Phase 3: Test Architecture Repair (Days 5-6)**

**Objective**: Fix 306 failing tests through RLS simplification

#### Day 5: Integration Test Updates

**Morning (4 hours)**:

```typescript
// Update test context creation for RLS
async function createTestContext(db: TestDatabase) {
  // Set RLS session for tests
  await db.execute(sql`SET app.current_organization_id = 'test-org'`);

  // Simple context - no coordination needed
  return {
    caller: appRouter.createCaller({
      db,
      user: testUser
    })
  };
}

- [ ] Update all 10 integration test files
- [ ] Remove organizationId coordination
- [ ] Simplify test data factories
```

**Afternoon (4 hours)**:

```typescript
// Fix high-priority failing tests
- [ ] admin.integration.test.ts (30+ tests)
- [ ] issue.timeline.integration.test.ts
- [ ] location.aggregation.integration.test.ts
- [ ] model.core.integration.test.ts
```

#### Day 6: Router Test & Mock Updates

**Morning (4 hours)**:

```typescript
// Update router test mocks for Drizzle + RLS
- [ ] Fix 12 router test files
- [ ] Update mock patterns for RLS context
- [ ] Remove organizationId from mock data
- [ ] Simplify assertion patterns
```

**Afternoon (4 hours)**:

```typescript
// Convert "fake integration" tests
- [ ] commentService.test.ts → tRPC integration
- [ ] notificationService.test.ts → tRPC integration
- [ ] Remove direct service testing pattern
- [ ] Establish proper test boundaries
```

**Validation Checkpoint**:

- ✅ Integration tests passing (10 files)
- ✅ Router tests passing (12 files)
- ✅ Service tests converted to proper patterns

---

### **Phase 4: Cleanup & Optimization (Days 7-8)**

**Objective**: Remove legacy code and optimize for RLS architecture

#### Day 7: Code Cleanup

**Morning (4 hours)**:

```typescript
// Remove organizational management code
- [ ] Delete organizationId utilities (200+ lines)
- [ ] Remove complex middleware logic (100+ lines)
- [ ] Clean up context types
- [ ] Simplify data factories
```

**Afternoon (4 hours)**:

```typescript
// Optimize query patterns for RLS
- [ ] Remove unnecessary joins
- [ ] Simplify relational queries
- [ ] Update type definitions
- [ ] Performance testing
```

#### Day 8: Documentation & Validation

**Morning (4 hours)**:

```markdown
// Create documentation

- [ ] RLS architecture guide
- [ ] Testing archetype documentation
- [ ] Migration completion notes
- [ ] Update README
```

**Afternoon (4 hours)**:

```bash
# Final validation
- [ ] Run full test suite (expect 100% pass)
- [ ] Manual testing of core flows
- [ ] Performance benchmarking
- [ ] Create backup point
```

---

## 📊 Task Execution Checklist

### **Immediate Actions (Day 1)**

```bash
# Start with service layer conversion
1. git checkout -b unified-migration-rls
2. Read current service implementations
3. Convert services to Drizzle-only
4. Update tRPC context
5. Commit: "refactor: complete service layer Drizzle conversion"
```

### **Critical Path Items**

- **Day 1-2**: Prisma removal must complete before RLS
- **Day 3-4**: RLS policies must be tested before app integration
- **Day 5-6**: Test fixes depend on RLS being functional
- **Day 7-8**: Cleanup only after tests pass

### **Parallel Work Opportunities**

- Documentation can be written during downtime
- Test archetype templates can be created early
- Performance benchmarks can run overnight

---

## 🎯 Success Criteria

### **Phase 1 Success** (Prisma Removal)

- [ ] Zero Prisma imports in codebase
- [ ] All services using Drizzle
- [ ] TypeScript compilation passes
- [ ] No prisma packages in package.json

### **Phase 2 Success** (RLS Implementation)

- [ ] RLS enabled on all multi-tenant tables
- [ ] Session context management working
- [ ] Queries automatically org-scoped
- [ ] No manual organizationId filtering

### **Phase 3 Success** (Test Repair)

- [ ] 306 failing tests now passing
- [ ] Test setup simplified
- [ ] No organizationId in test data
- [ ] Clear test architecture boundaries

### **Phase 4 Success** (Optimization)

- [ ] 1000+ lines of code removed
- [ ] Documentation complete
- [ ] Performance acceptable
- [ ] Clean git history

---

## 🚨 Risk Mitigation

### **Potential Risks & Mitigations**

**Risk 1: RLS Performance Issues**

- **Mitigation**: Add indexes on organization_id columns
- **Fallback**: Can disable RLS per-table if needed

**Risk 2: Unexpected RLS Behavior**

- **Mitigation**: Extensive testing in Phase 2
- **Fallback**: Git checkpoint after each phase

**Risk 3: Test Complexity**

- **Mitigation**: Fix integration tests first (highest value)
- **Fallback**: Can temporarily skip low-priority tests

**Risk 4: Time Overrun**

- **Mitigation**: Phase 4 cleanup is optional
- **Fallback**: Can defer optimization to later

---

## 📈 Expected Outcomes

### **Immediate Benefits**

- ✅ Complete Prisma removal
- ✅ 306 tests passing
- ✅ Simplified codebase
- ✅ Database-level security

### **Long-term Benefits**

- ✅ Zero organizationId management
- ✅ Trivial test setup
- ✅ Faster feature development
- ✅ Industry-standard architecture

### **Code Reduction Estimates**

```
Before: ~15,000 lines with organizational complexity
After:  ~13,500 lines with automatic multi-tenancy
Reduction: ~1,500 lines (10% codebase reduction)
```

---

## 🚀 Execution Commands

### **Day 1 Start**

```bash
# Create migration branch
git checkout -b unified-migration-rls

# Verify current state
npm run test:brief  # Document failing count
npm run typecheck   # Ensure clean start

# Begin service conversion
code src/server/services/roleService.ts
```

### **Daily Validation**

```bash
# End of each day
npm run typecheck           # Must pass
npm run test:brief          # Track progress
git commit -m "feat: [phase] [accomplishment]"
```

### **Phase Checkpoints**

```bash
# After each phase
git tag phase-X-complete
npm run test > test-results-phaseX.txt
git push origin unified-migration-rls --tags
```

---

## 📅 Timeline Summary

**Total Duration**: 7-8 days (with 1 day buffer)

| Phase       | Duration | Outcome                                |
| ----------- | -------- | -------------------------------------- |
| **Phase 1** | 2 days   | Prisma removed, Drizzle-only           |
| **Phase 2** | 2 days   | RLS implemented, policies active       |
| **Phase 3** | 2 days   | 306 tests fixed, architecture improved |
| **Phase 4** | 1-2 days | Code cleaned, documentation complete   |

**Start Date**: Tomorrow morning  
**Target Completion**: Next week  
**Critical Success**: Phase 1-3 (6 days minimum)  
**Nice to Have**: Phase 4 (cleanup/optimization)

---

## 🎯 First Day Action Plan

### **Morning Standup (9:00 AM)**

1. Review this plan
2. Create branch
3. Set up monitoring (test count tracker)

### **Morning Work (9:30 AM - 12:30 PM)**

1. Convert roleService.ts
2. Convert permissionService.ts
3. Test service functionality

### **Afternoon Work (1:30 PM - 5:30 PM)**

1. Update tRPC context
2. Remove Prisma from context
3. Fix immediate TypeScript errors

### **End of Day (5:30 PM)**

1. Commit progress
2. Run test suite
3. Document blockers

---

## 📝 Notes

**Why RLS Over Symptom Fixes**:

- Permanent solution vs temporary relief
- Industry standard approach
- Simplifies entire codebase
- Makes future features easier

**Why This Order**:

1. Must remove Prisma first (can't have two ORMs with RLS)
2. RLS implementation enables test fixes
3. Tests validate RLS is working correctly
4. Cleanup only after stability achieved

**Key Insight**: This isn't just migration completion - it's an architectural upgrade that permanently eliminates an entire class of complexity from the codebase.

---

**Ready to Execute!** 🚀

Start tomorrow with Phase 1, Day 1: Service layer conversion.
