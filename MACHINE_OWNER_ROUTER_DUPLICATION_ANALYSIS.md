# Machine Owner Router Test Duplication Analysis & Elimination Plan

**Status**: Ready for consolidation by dedicated agent  
**Context**: Machine router work in progress - consolidation deferred to avoid conflicts  
**Priority**: Medium - 1,300+ lines of duplicate code identified

## 🔍 **Duplication Analysis**

### **Critical Findings:**

1. **Complete file duplication** with misplaced integration tests
2. **2 router families affected**: `machine.owner` and `machine.location`
3. **Identical testing patterns** but different locations and coverage depth

### **Specific Duplications Identified:**

#### **Machine Owner Router:**

- **Misplaced**: `src/server/api/routers/__tests__/machine.owner.test.ts` (763 lines)
  - Labels itself as "Integration Tests" but located in unit test directory
  - Uses PGlite + `withIsolatedTest` (integration test patterns)
  - Comprehensive coverage: 7 major test categories
  - Advanced RLS context switching tests
  - Better organizational scoping tests
  - More thorough error scenarios
- **Proper Location**: `src/integration-tests/machine.owner.integration.test.ts` (516 lines)
  - Located correctly in integration test directory
  - Similar PGlite patterns but simpler coverage
  - Fewer test categories: 4 major sections
  - Less comprehensive edge case testing

#### **Machine Location Router:**

- **Misplaced**: `src/server/api/routers/__tests__/machine.location.test.ts`
  - Also labeled as "Integration Tests" in wrong location
  - Same PGlite integration test patterns
- **Proper Location**: `src/integration-tests/machine.location.integration.test.ts`
  - Correctly located integration test

### **Overlapping Test Scenarios:**

1. **Successful operations** (assign owner, move location)
2. **Error handling** (NOT_FOUND, FORBIDDEN)
3. **Membership validation** (org member checks)
4. **Relationship loading** (model/location/owner joins)
5. **Data security** (safe field exposure)
6. **Organizational scoping** (multi-tenant isolation)

## 🎯 **Consolidation Strategy**

### **Phase 1: Machine Owner Router Consolidation**

1. **Keep the comprehensive version** from `src/server/api/routers/__tests__/`
   - It has more thorough coverage (763 vs 516 lines)
   - Includes advanced RLS context switching
   - Better organizational scoping tests
2. **Extract unique tests** from `src/integration-tests/` version
   - Compare both files line-by-line
   - Identify any test cases not covered in router version
   - Merge unique scenarios into comprehensive version
3. **Move consolidated test** to correct location
   - Move final version to `src/integration-tests/machine.owner.integration.test.ts`
   - Delete misplaced router test file
   - Delete redundant integration test file

### **Phase 2: Machine Location Router Consolidation**

1. **Apply same pattern** to machine location router
2. **Compare and merge** unique test cases
3. **Relocate to proper directory**

### **Phase 3: Verification**

1. **Run tests** to ensure consolidation maintains coverage
2. **Validate file locations** match vitest config patterns
3. **Confirm memory-safe PGlite patterns** are preserved

## 📋 **Detailed Execution Steps**

### **For Machine Owner Router:**

```bash
# 1. Compare files to identify unique content
diff src/server/api/routers/__tests__/machine.owner.test.ts \
     src/integration-tests/machine.owner.integration.test.ts

# 2. Keep the more comprehensive version (router one has 763 vs 516 lines)
# 3. Extract any unique tests from integration version
# 4. Move consolidated file to proper location
# 5. Delete both original files
# 6. Verify tests pass in integration environment
```

### **Key Areas to Preserve:**

- **RLS context switching tests** (lines 614-684 in router version)
- **Advanced organizational scoping** (more thorough in router version)
- **Comprehensive error scenarios** (router version has more edge cases)
- **Memory-safe PGlite patterns** (both use `withIsolatedTest` correctly)

## 📊 **Expected Impact**

- **Eliminate ~1,300 lines** of duplicate test code
- **Improve test organization** (proper integration test location)
- **Maintain comprehensive coverage** (keep best tests from both)
- **Preserve memory safety** (worker-scoped PGlite patterns)

## ⚠️ **Risk Mitigation**

- **Incremental approach**: Handle one router at a time
- **Test verification**: Run tests after each consolidation
- **Coverage preservation**: Ensure no unique test scenarios are lost
- **Location validation**: Ensure tests run in correct vitest environment (integration project)

## 🔧 **Commands for Agent Execution**

```bash
# Run after machine router work is complete
npm run test -- machine.owner  # Verify current tests pass
npm run test -- machine.location  # Verify current tests pass

# After consolidation
npm run test -- --project=integration machine.owner.integration.test.ts
npm run test -- --project=integration machine.location.integration.test.ts
```

## 📝 **Files to Consolidate**

### **Machine Owner Router:**

- Source (comprehensive): `src/server/api/routers/__tests__/machine.owner.test.ts` (763 lines)
- Source (simpler): `src/integration-tests/machine.owner.integration.test.ts` (516 lines)
- Target: `src/integration-tests/machine.owner.integration.test.ts` (consolidated)

### **Machine Location Router:**

- Source (misplaced): `src/server/api/routers/__tests__/machine.location.test.ts`
- Source (proper): `src/integration-tests/machine.location.integration.test.ts`
- Target: `src/integration-tests/machine.location.integration.test.ts` (consolidated)

---

**Next Action**: Execute when machine router development work is complete and stable.
