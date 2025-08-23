# Test Conversion Priority Matrix

**Strategic Priority Framework**: Memory Safety → Architecture Compliance → RLS Benefits → Pattern Consistency

**Total Scope**: 95 test files across 8 archetypes and 3 specialized agents

---

## 🚨 **CRITICAL PRIORITY** (Immediate Action - 0 files)

### **Memory Safety Critical** ✅ **ALL CLEAR**
**Status**: **NO DANGEROUS PATTERNS FOUND**

**Validation Complete**:
- ✅ **No per-test PGlite instances** (prevents 50-100MB per test memory blowout)
- ✅ **All integration tests use worker-scoped patterns** 
- ✅ **Proper transaction isolation** with `withIsolatedTest`
- ✅ **Estimated memory usage**: ~200-400MB total (safe operational range)

**Exemplary Safe Patterns Found**:
- `commentService.integration.test.ts` - Perfect worker-scoped PGlite usage
- `location.integration.test.ts` - Proper transaction isolation
- `cross-org-isolation.test.ts` - Safe multi-context testing

---

## 🔥 **HIGH PRIORITY** (High Impact, Foundational - 48 files)

### **Architecture Compliance Critical** (15 files)

**Router Unit → tRPC Router Conversion** (13 files)
```
Target: integration-test-architect
Archetype: 1 → 5 (Unit Test → tRPC Router Test)
Impact: Major architectural alignment + RLS benefits
Effort: 40-80 hours

Files:
- issue.test.ts
- issue.timeline.test.ts  
- issue.notification.test.ts
- issue.confirmation.test.ts
- model.core.test.ts
- model.opdb.test.ts
- machine.owner.test.ts
- machine.location.test.ts
- notification.test.ts
- pinballMap.test.ts
- collection.test.ts
- routers.integration.test.ts
- routers.drizzle.integration.test.ts
```

**Mixed Concern Decomposition** (1 file)
```
Target: unit-test-architect + integration-test-architect
File: IssueList.unit.test.tsx
Issue: Mixed unit/integration concerns in single file
Action: Split into pure unit test + separate integration test
Effort: 4-8 hours
```

**Security Archetype Alignment** (5 files)
```
Target: security-test-architect
Files: Files in integration-tests/ with security focus
Issue: Security tests in wrong archetype category
Action: Move to Archetypes 6, 7, or 8
Effort: 10-20 hours
```

### **Foundational Pattern Establishment** (33 files)

**Component Test Standardization** (15 files)
```
Target: unit-test-architect
Archetype: 4 (React Component Unit Test)
Impact: Establish template patterns for future development
Effort: 15-30 hours

Priority Files:
- MachineDetailView.test.tsx (exemplary pattern)
- PrimaryAppBar.test.tsx (auth integration model)
- PermissionGate.test.tsx (permission testing template)
- MachineCard.test.tsx (component behavior standard)
```

**Pure Function Standardization** (18 files)
```
Target: unit-test-architect  
Archetype: 1 (Pure Function Unit Test)
Impact: Fast execution patterns for business logic
Effort: 12-24 hours

Categories:
- Validation schemas (8 files)
- Utility functions (5 files) 
- Auth helpers (3 files)
- Business logic (2 files)
```

---

## ⚡ **MEDIUM PRIORITY** (RLS Benefits & Enhancement - 32 files)

### **RLS Integration Enhancement** (25 files)

**Router RLS Session Context** (15 files)
```
Target: integration-test-architect
Benefit: Simplify organizational coordination → simple session context
Current: Complex createTestContext coordination
Future: SET app.current_organization_id = 'test-org'
Effort: 20-40 hours
```

**Service RLS Simplification** (7 files)
```
Target: integration-test-architect
Benefit: Eliminate organizationId parameters via RLS session
Current: service.create({ title: "Test", organizationId: "org-1" })
Future: service.create({ title: "Test" }) // RLS handles scoping
Effort: 14-28 hours
```

**Cross-Org Boundary Enhancement** (3 files)
```
Target: security-test-architect
Benefit: Comprehensive organizational isolation validation
Enhancement: Multi-context testing, boundary verification
Effort: 6-12 hours
```

### **Pattern Modernization** (7 files)

**vi.mock Pattern Updates** (5 files)
```
Target: unit-test-architect
Issue: Old Jest patterns → modern Vitest vi.mock
Benefit: Better TypeScript integration, faster execution
Effort: 5-10 hours
```

**Import Path Standardization** (2 files)
```
Target: All agents
Issue: Relative imports → TypeScript aliases
Benefit: Maintainability, IDE support
Effort: 2-4 hours
```

---

## 📈 **LOW PRIORITY** (Polish & Maintenance - 15 files)

### **Incremental Improvements** (12 files)

**Test Helper Consolidation** (6 files)
```
Opportunity: Reduce duplication in test setup
Benefit: DRY principle, easier maintenance
Effort: 6-12 hours
```

**Documentation Enhancement** (4 files)
```
Opportunity: Better test descriptions, archetype clarity
Benefit: Developer experience, knowledge transfer
Effort: 4-8 hours
```

**Minor Pattern Alignment** (2 files)
```
Opportunity: Small archetype template adjustments
Benefit: Complete consistency across test suite
Effort: 2-4 hours
```

### **Already Excellent** (3 files)

**Exemplary Patterns** ✅
```
Files demonstrating perfect archetype alignment:
- commentService.integration.test.ts (Archetype 3 - PGlite Integration)
- cross-org-isolation.test.ts (Archetype 7 - RLS Policy)
- formatters.test.ts (Archetype 1 - Pure Function)

Action: Use as templates for conversions
```

---

## 🎯 **Agent-Specific Priority Assignments**

### **`unit-test-architect`** - 38 files total

**HIGH PRIORITY** (33 files):
- **Component standardization**: 15 files (Archetype 4)
- **Pure function templates**: 18 files (Archetype 1)  
- **Mixed concern decomposition**: 1 file (split)

**MEDIUM PRIORITY** (3 files):
- **vi.mock modernization**: Pattern updates
- **Import path standardization**: Alias adoption

**LOW PRIORITY** (2 files):
- Minor pattern alignment

### **`integration-test-architect`** - 40 files total

**HIGH PRIORITY** (15 files):
- **Router unit → tRPC router conversion**: Major architectural change
- **RLS session context implementation**: Foundation for simplification

**MEDIUM PRIORITY** (22 files):
- **RLS integration enhancement**: Organizational coordination simplification
- **Service RLS benefits**: Parameter elimination via session context

**LOW PRIORITY** (3 files):
- Test helper consolidation
- Minor integration pattern improvements

### **`security-test-architect`** - 22 files total

**HIGH PRIORITY** (5 files):
- **Security archetype alignment**: Move tests to proper categories
- **RLS policy enhancement**: Strengthen boundary validation

**MEDIUM PRIORITY** (14 files):
- **Cross-org boundary testing**: Comprehensive isolation validation
- **Permission matrix enhancement**: Role-based access validation

**LOW PRIORITY** (3 files):
- Documentation improvements
- Minor security pattern refinements

---

## 📊 **Effort Summary by Priority**

### **Total Effort Estimation**

| **Priority** | **Files** | **Hours (Low)** | **Hours (High)** | **Impact** |
|---|---|---|---|---|
| **Critical** | 0 | 0 | 0 | ✅ Complete |
| **High** | 48 | 81 | 162 | Foundational |
| **Medium** | 32 | 47 | 94 | Enhancement |
| **Low** | 15 | 15 | 30 | Polish |
| **TOTAL** | **95** | **143** | **286** | **Complete** |

### **Resource Allocation Strategy**

**Phase 1 (Weeks 1-2)**: High Priority Foundation
- Focus: Architecture compliance + pattern establishment
- Target: 48 files requiring foundational changes
- Effort: 81-162 hours

**Phase 2 (Weeks 3-4)**: Medium Priority Enhancement  
- Focus: RLS integration + pattern modernization
- Target: 32 files benefiting from RLS and modern patterns
- Effort: 47-94 hours

**Phase 3 (Week 5)**: Low Priority Polish
- Focus: Final cleanup + documentation
- Target: 15 files requiring minor improvements
- Effort: 15-30 hours

---

## ✅ **Success Validation Framework**

### **Phase Completion Criteria**

**High Priority Complete**:
- [ ] All router tests use tRPC Router archetype patterns
- [ ] Component tests follow standardized Archetype 4 templates
- [ ] Pure function tests demonstrate Archetype 1 excellence
- [ ] Security tests properly categorized in Archetypes 6, 7, 8

**Medium Priority Complete**:
- [ ] RLS session context eliminates organizational coordination complexity
- [ ] Service tests benefit from automatic organizational scoping
- [ ] Modern Vitest patterns applied consistently

**Low Priority Complete**:
- [ ] Test helpers consolidated and well-documented
- [ ] Import paths standardized across all test files
- [ ] All 8 archetypes demonstrate template excellence

### **Quality Gates**

**Memory Safety** (Continuous):
- Memory usage remains under 500MB during full test execution
- No regression to dangerous PGlite patterns

**Archetype Compliance** (End of each phase):
- Files properly categorized according to 8-archetype system
- Agent specialization alignment maintained

**RLS Benefits Realization** (End of Phase 2):
- Organizational scoping simplified via session context
- Cross-organizational isolation comprehensively tested

---

**Status**: ✅ **Priority Matrix Complete - Ready for Systematic Execution**

This priority matrix provides clear guidance for converting all 95 test files systematically while maximizing impact and maintaining excellent memory safety standards.