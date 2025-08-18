# Migration Execution Guide: Prisma Removal + RLS Implementation

**Purpose**: Essential guidance for agents working on the architectural migration  
**Context**: Solo development, forward-only approach, 306 failing tests requiring architectural transformation  
**Current Status**: Final Prisma removal phase - service layer conversion in progress

---

## Migration Context

**Strategic Approach**: Complete Prisma removal + RLS implementation (unified migration)  
**Not**: Fixing 306 test symptoms - this is permanent architecture transformation  
**Timeline**: 2-3 weeks for complete architectural transformation  
**Outcome**: Production-grade multi-tenancy with zero organizational complexity

---

## Phase Dependencies (IMMUTABLE)

**CRITICAL**: Phase sequence is technically immutable, not arbitrary planning

```
Phase 1: Prisma Removal
    ↓ [DEPENDENCY GATE]
Phase 2: RLS Implementation  
    ↓ [DEPENDENCY GATE]
Phase 2.5: Testing Architecture Design
    ↓ [DEPENDENCY GATE]
Phase 3: Test Implementation (306 → 0 failures)
    ↓ [DEPENDENCY GATE]
Phase 4: Cleanup & Documentation
```

**Why Immutable**: Working on tests before RLS completion creates impossible dual-ORM states

---

## Operational Commands

### Phase Validation
```bash
# Continuous validation during migration work
npm run validate-migration-phase

# Phase-specific validation
npm run validate-file src/server/services/userService.ts
npm run test:brief
```

### Progress Monitoring
```bash
# Check Prisma removal progress
rg -c "prisma" src/

# Check RLS implementation progress  
rg -c "ROW LEVEL SECURITY" scripts/migrations/

# Check test conversion progress
rg -l "withIsolatedTest" src/ | wc -l
```

### Quality Gates
```bash
# Before phase transitions
npm run typecheck:brief
npm run lint
npm run test:memory-check  # Ensure no PGlite memory leaks
```

---

## Risk Prevention

### Architecture Focus Discipline
- **Phase 1-2**: NO test fixing - architecture work only
- **Phase 3**: Test implementation using established RLS patterns
- **Never**: Add features during migration phases

### Context Switching Prevention
**FORBIDDEN during Phase 1-2**:
- Attempting to fix failing tests
- Adding new features 
- Performance optimization
- Debugging individual test failures

**REQUIRED during Phase 1-2**:
- Service layer Prisma → Drizzle conversion
- RLS policy implementation
- Testing architecture design

### Memory Safety Vigilance
- NEVER use `new PGlite()` per test (causes system lockups)
- ALWAYS use `withIsolatedTest` pattern for integration tests
- Monitor memory usage during test development

---

## Success Gates

### Phase 1 Complete When:
- [ ] Zero Prisma references: `rg -c "prisma" src/` returns 0
- [ ] TypeScript compilation passes: `npm run typecheck:brief`
- [ ] All services converted to Drizzle-only
- [ ] tRPC context has single database client

### Phase 2 Complete When:
- [ ] RLS policies implemented for core tables (5+ policies)
- [ ] Session management working with RLS context
- [ ] Basic CRUD operations functional with organizational isolation
- [ ] Cross-organizational data isolation verified

### Phase 2.5 Complete When:
- [ ] Testing methodology documented
- [ ] Memory-safe test patterns implemented  
- [ ] RLS test helpers created and validated
- [ ] Example conversions demonstrate patterns work

### Phase 3 Complete When:
- [ ] All 306 tests converted to RLS patterns
- [ ] Test pass rate ≥90%
- [ ] Memory usage stable during test execution
- [ ] Zero manual `organizationId` management in tests

---

## Key Strategic Insights

### Most Important: Architecture Mindset
**Frame**: This is an architecture decision, not debugging exercise  
**Impact**: Prevents symptom-fixing shortcuts that waste weeks

### Second Most Important: Dependency Discipline  
**Frame**: Phase sequence is technically immutable  
**Impact**: Prevents impossible mixed states (dual-ORM conflicts)

### Testing Architecture Bridge
**Frame**: Design excellent patterns BEFORE fixing tests  
**Impact**: Ensures 306 test repairs realize full RLS benefits

---

## Expected Transformation

### Before (Manual Multi-Tenancy):
```typescript
// Every query requires organizationId filtering
const issues = await db.query.issues.findMany({
  where: and(
    eq(issues.organizationId, ctx.user.organizationId), // Manual!
    eq(issues.status, "open"),
  ),
});
```

### After (RLS Automatic):
```typescript  
// Organizational security is automatic
const issues = await db.query.issues.findMany({
  where: eq(issues.status, "open"),
  // RLS handles organizational scoping automatically!
});
```

### Test Experience Transformation:
- **Before**: 20+ lines organizational setup per test
- **After**: 1 line auth context: `await withAuth("user@org.com", async () => {...})`

---

## Work Session Commands

```bash
# Start migration work session
npm run validate-migration-phase

# Daily progress check
echo "Prisma refs: $(rg -c 'prisma' src/)"
echo "RLS policies: $(rg -c 'ROW LEVEL SECURITY' scripts/migrations/)"

# Before committing progress
npm run validate && git add -A && git commit -m "Progress: [description]"
```

---

**Success Metric**: Transform 306 failing tests into architectural excellence through disciplined phase execution and forward-only momentum.