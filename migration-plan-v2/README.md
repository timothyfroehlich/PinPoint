# Migration Plan v2: Unified Prisma Removal + RLS Implementation

**The Definitive Architecture Migration That Transforms 306 Failing Tests Into Excellence**

---

## 🎯 Executive Summary

This migration plan represents a **permanent architectural decision** that will define development experience for the next two years. Rather than fixing 306 failing test symptoms, we implement production-grade Row Level Security (RLS) to eliminate organizational complexity forever.

### The Strategic Choice

```
❌ REACTIVE: Fix 306 tests → Same problems return perpetually
✅ STRATEGIC: Implement RLS → Permanent solution + architectural excellence
```

**Key Insight**: The failing tests reveal that manual multi-tenancy (organizationId everywhere) is fundamentally fighting the developer. RLS transforms this friction into automatic database-level security.

---

## 📚 Navigation Guide

### Strategic Foundation

- **[00-strategic-overview.md](./00-strategic-overview.md)** - The architecture decision and vision
- **[06-risk-management.md](./06-risk-management.md)** - Psychological and technical risk mitigation
- **[07-execution-framework.md](./07-execution-framework.md)** - Daily procedures and git workflows

### Technical Implementation

- **[01-phase1-prisma-removal.md](./01-phase1-prisma-removal.md)** - Complete Prisma elimination
- **[02-phase2-rls-implementation.md](./02-phase2-rls-implementation.md)** - Row Level Security implementation
- **[03-phase2.5-testing-architecture.md](./03-phase2.5-testing-architecture.md)** - 8 testing archetypes for RLS
- **[04-phase3-test-implementation.md](./04-phase3-test-implementation.md)** - Systematic test repair (306 → 0 failures)
- **[05-phase4-cleanup-docs.md](./05-phase4-cleanup-docs.md)** - Legacy cleanup and documentation

---

## 🚀 Implementation Flow

### Phase Execution Order (IMMUTABLE DEPENDENCIES)

```
Phase 1: Prisma Removal
    ↓ [DEPENDENCY GATE]
Phase 2: RLS Implementation
    ↓ [DEPENDENCY GATE]
Phase 2.5: Testing Architecture Design
    ↓ [DEPENDENCY GATE]
Phase 3: Test Implementation
    ↓ [DEPENDENCY GATE]
Phase 4: Cleanup & Documentation
```

**CRITICAL**: Phase dependencies are technically immutable. Attempting to fix tests before RLS implementation creates impossible dual-ORM states.

### Work Session Flow

```bash
# 1. Dependency gate validation
npm run validate-migration-phase

# 2. Current phase work
# See phase-specific documents for detailed procedures

# 3. Progress checkpoint
git checkout -b progress-checkpoint-$(date +%Y%m%d-%H%M)
git add . && git commit -m "Checkpoint: [phase] progress"
```

---

## 💡 Critical Strategic Insights

### Most Important Thing: Architecture Mindset

**Frame**: This is an architecture decision, not debugging exercise  
**Impact**: Prevents symptom-fixing shortcuts that waste weeks of effort  
**Reference**: [Strategic Overview](./00-strategic-overview.md#the-architecture-decision)

### Second Most Important: Dependency Discipline

**Frame**: Phase sequence is technically immutable, not arbitrary  
**Impact**: Prevents impossible mixed states (dual-ORM conflicts)  
**Reference**: [Risk Management](./06-risk-management.md#dependency-chain-enforcement)

### Testing Architecture Bridge

**Frame**: Design excellent patterns BEFORE fixing tests  
**Impact**: Ensures 306 test repairs realize full RLS benefits  
**Reference**: [Testing Architecture](./03-phase2.5-testing-architecture.md#rls-testing-transformation)

---

## 🎖️ Success Transformation Vision

### Developer Experience: Before vs After

**BEFORE (Manual Multi-Tenancy)**:

```typescript
// Every query is organizational nightmare
const issues = await db.query.issues.findMany({
  where: and(
    eq(issues.organizationId, ctx.user.organizationId), // Manual!
    eq(issues.status, "open"),
  ),
});
```

**AFTER (RLS Automatic)**:

```typescript
// Organizational security is automatic
const issues = await db.query.issues.findMany({
  where: eq(issues.status, "open"),
  // RLS handles organizational scoping automatically!
});
```

### Testing Experience: Before vs After

**BEFORE (Complex Coordination)**:

```typescript
// 20+ lines organizational setup
beforeEach(async () => {
  testOrg = await createTestOrganization();
  testUser = await createTestUser(testOrg.id);
  // ... 15 more lines manual setup
});
```

**AFTER (Simple Session Context)**:

```typescript
// 1 line organizational context
test("issue creation", async ({ withAuth }) => {
  await withAuth("user@acme.com", async () => {
    // Automatic organizational context
  });
});
```

---

## 📊 Architecture Impact Metrics

### Complexity Elimination

- **Manual filtering queries**: 100+ → 0
- **Organizational test setup**: ~900 lines → ~50 lines
- **Security boundary management**: Manual → Automatic
- **Multi-tenant debugging**: Complex → Impossible to get wrong

### Development Velocity

- **Feature development**: "How do I handle organizationId?" → Pure business logic
- **Test writing**: Complex setup → Simple auth context
- **Debugging**: Organizational vs business logic → Always business logic
- **New developer onboarding**: Multi-tenancy lecture → "Database handles it"

---

## 🛡️ Risk Management Summary

### Psychological Risks (HIGHEST PRIORITY)

- **Progress Impatience**: Slow architecture progress triggers test-fixing impulses
- **Dependency Chain Breaking**: Pressure to work on tests before RLS completion
- **Shortcut Temptation**: 306 failing tests create urgency for quick wins

**Mitigation**: [Risk Management protocols](./06-risk-management.md#psychological-risk-management)

### Technical Risks (HIGH PRIORITY)

- **RLS Implementation Complexity**: Multi-tenant session management challenges
- **Dual-ORM Conflicts**: Impossible mixed states during transition
- **Memory Safety**: PGlite worker-scoped patterns prevent system lockups

**Mitigation**: [Execution Framework procedures](./07-execution-framework.md#execution-procedures)

---

## 📋 Quality Validation Framework

### Phase Completion Gates

**Phase 1 Complete When**:

- [ ] Zero Prisma references in codebase
- [ ] All routers using pure Drizzle
- [ ] tRPC context has single database client
- [ ] TypeScript compilation passes

**Phase 2 Complete When**:

- [ ] RLS policies implemented for all core tables
- [ ] Session management working correctly
- [ ] Basic CRUD operations with RLS functional
- [ ] Cross-organizational isolation verified

**Phase 3 Complete When**:

- [ ] All 306 tests pass consistently
- [ ] Every test follows defined archetype patterns
- [ ] Memory usage remains stable (<500MB)
- [ ] Test execution performance optimized

### Quality Assurance Commands

```bash
# Technical validation
npm run validate          # Full project validation
npm run test:brief        # Fast test status check
npm run typecheck:brief   # TypeScript validation

# Migration-specific validation
npm run validate-migration-phase    # Dependency gate checking
npm run validate-test-patterns      # Archetype compliance
npm run memory-usage-check          # PGlite memory safety
```

---

## 🎯 Document Integration Matrix

| Phase Focus             | Primary Documents                         | Supporting Documents                                     |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------- |
| **Strategic Planning**  | 00-strategic-overview, 06-risk-management | 07-execution-framework                                   |
| **Phase 1 Execution**   | 01-phase1-prisma-removal                  | 07-execution-framework, 06-risk-management               |
| **Phase 2 Execution**   | 02-phase2-rls-implementation              | 07-execution-framework, 06-risk-management               |
| **Phase 2.5 Execution** | 03-phase2.5-testing-architecture          | 07-execution-framework                                   |
| **Phase 3 Execution**   | 04-phase3-test-implementation             | 03-phase2.5-testing-architecture, 07-execution-framework |
| **Phase 4 Execution**   | 05-phase4-cleanup-docs                    | 07-execution-framework                                   |

---

## 🌟 Solo Development Context Advantages

### Why This Context Is Perfect

- **No coordination overhead**: Can break things temporarily during migration
- **Full control**: Make breaking changes without team disruption
- **Direct feedback**: Immediately feel architectural improvements
- **Learning opportunity**: Deep understanding of RLS patterns

### Leverage High Risk Tolerance

- **Pre-beta status**: Zero production users affected
- **Schema flexibility**: Can make breaking changes to optimize architecture
- **Test isolation**: Can rewrite test patterns without user impact
- **Experimental freedom**: Try approaches until optimal solution found

---

## 🎖️ Migration Success Criteria

### Technical Excellence Achieved

- **306 failing tests** → **0 failing tests**
- **1000+ lines organizational filtering** → **0 lines**
- **Complex test setup patterns** → **Simple archetype patterns**
- **Manual security boundaries** → **Automatic RLS enforcement**

### Architectural Foundation Established

- **Database-level multi-tenancy** with automatic organizational scoping
- **Sustainable testing methodology** designed for 2+ year lifespan
- **Developer experience transformation** eliminating organizational complexity
- **Production-ready security** with PostgreSQL RLS policies

### Long-term Benefits Realized

- **Zero organizational complexity** in future feature development
- **Consistent developer velocity** regardless of application complexity
- **Impossible to create security vulnerabilities** via manual filtering mistakes
- **Test writing easier than production code** through excellent patterns

---

## 🚀 Implementation Command

```bash
# Start the transformation
cd migration-plan-v2
git checkout -b architectural-transformation-v2

# Phase 1: Begin Prisma removal
# See 01-phase1-prisma-removal.md for detailed procedures
```

---

## 📖 Background Context

This migration plan was developed through comprehensive analysis of:

- **UNIFIED-MIGRATION-PLAN.md** - Original strategic framework
- **ACTUALLY-INTEGRATION-TESTS.md** - Root cause analysis of 306 failing tests
- **STRATEGIC-MIGRATION-FRAMEWORK.md** - Critical success factor synthesis
- **Latest tech stack updates** - August 2025 Supabase SSR, Drizzle v0.32.0+, Next.js patterns

The plan leverages solo development advantages and pre-beta context to implement industry-standard RLS patterns that eliminate organizational complexity permanently.

---

**Ready to transform 306 failing tests into architectural excellence?**  
**Start with [Strategic Overview](./00-strategic-overview.md) for the complete vision.**

---

_"Sometimes the best way to fix 306 failing tests is to build a better architecture where those problems simply cannot exist."_
