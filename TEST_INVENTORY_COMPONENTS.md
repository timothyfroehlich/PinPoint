# Component & UI Test Files - 8-Archetype Analysis

**Analysis Date**: 2025-08-19  
**Total Files Analyzed**: 19 component/page test files  
**Target Archetypes**: 1 (Pure Function Unit), 4 (React Component Unit)  
**Target Agent**: `unit-test-architect`

## Executive Summary

**Distribution Overview**:
- **Archetype 1** (Pure Function Unit): 2 files - Simple utility functions
- **Archetype 4** (React Component Unit): 15 files - React component testing with mocks
- **Mixed/Complex**: 2 files - Integration-style tests that need decomposition

**Key Findings**:
- 79% (15/19) are well-suited for `unit-test-architect` 
- 21% (4/19) require pattern updates or decomposition
- Most files use modern testing patterns but need minor archetype alignment
- Strong foundation for Phase 3 test architecture standardization

---

## Detailed File Analysis

### 📁 `/src/app/games/__tests__/page.test.tsx`

**Current Classification**: Archetype 1 (Pure Function Unit Test)  
**Target Classification**: Archetype 1  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Simple redirect logic testing with vi.hoisted mocks
- **Approach**: Tests pure function behavior (redirect call verification)
- **Complexity**: Low - 2 test cases covering redirect scenarios

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required  
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Perfect fit for `unit-test-architect` - simple, focused unit testing.

---

### 📁 `/src/app/games/[id]/__tests__/page.test.tsx`

**Current Classification**: Archetype 1 (Pure Function Unit Test)  
**Target Classification**: Archetype 1  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Similar redirect logic testing with parameter handling
- **Approach**: Pure function testing with async parameter resolution
- **Complexity**: Low - 4 test cases with parameter variations

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required  
- Test helper migration: Not Required

**Agent Assignment**: Ideal for `unit-test-architect` - clean unit testing patterns.

---

### 📁 `/src/app/issues/__tests__/issues-page.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Server Component testing with MSW server setup
- **Approach**: Mocked external dependencies, real component rendering
- **Complexity**: Medium - Auth testing with VitestTestWrapper

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No (already implemented)
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Good candidate for `unit-test-architect` - well-structured component tests.

---

### 📁 `/src/app/dashboard/_components/__tests__/PrimaryAppBar.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Complex React component with permission-based rendering
- **Approach**: Comprehensive permission scenarios with VitestTestWrapper
- **Complexity**: High - 16 test scenarios covering auth states

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No (already using VitestTestWrapper)
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Excellent for `unit-test-architect` - demonstrates advanced React component testing.

---

### 📁 `/src/app/machines/components/__tests__/MachineCard.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: React component with navigation and rendering logic
- **Approach**: Type-safe mock data factories, semantic queries
- **Complexity**: Medium - 9 test groups with edge cases

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Perfect fit for `unit-test-architect` - clean component testing patterns.

---

### 📁 `/src/app/machines/[id]/__tests__/page.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Server Component testing with mocked dependencies
- **Approach**: Error handling, metadata generation testing
- **Complexity**: Medium - Covers success, error, and metadata scenarios

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Good for `unit-test-architect` - structured component and metadata testing.

---

### 📁 `/src/components/issues/__tests__/MachineSelector.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Form component testing with tRPC integration
- **Approach**: Mock tRPC queries, accessibility testing
- **Complexity**: Medium - Comprehensive form interaction testing

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Excellent for `unit-test-architect` - demonstrates form component testing best practices.

---

### 📁 `/src/components/issues/__tests__/IssueList.unit.test.tsx`

**Current Classification**: Mixed (Unit with Integration patterns)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: Medium

**Analysis**:
- **Pattern**: Consolidated unit tests from multiple test files
- **Approach**: External API mocks with real component interactions
- **Complexity**: High - 14 test groups, 60+ test cases

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: Yes (split integration tests)
- Mocking pattern updates: Required (standardize to unit patterns)
- RLS session context needed: No (using VitestTestWrapper correctly)
- Import path changes: Not Required
- Test helper migration: Required (split integration concerns)

**Agent Assignment**: Needs decomposition - unit tests to `unit-test-architect`, integration tests to `integration-test-architect`.

---

### 📁 `/src/components/issues/__tests__/IssueList.integration.test.tsx`

**Current Classification**: Mixed (Integration with Auth patterns)  
**Target Classification**: Archetype 7 (Integration Test)  
**Target Agent**: `integration-test-architect`  
**Confidence**: Low

**Analysis**:
- **Pattern**: Auth integration testing with workflow scenarios
- **Approach**: Real auth context with component interactions
- **Complexity**: High - Multi-role auth scenarios, workflow testing

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: Yes (move to integration archetype)
- Mocking pattern updates: Required (reduce mocking, use real implementations)
- RLS session context needed: Yes (already implemented)
- Import path changes: Not Required
- Test helper migration: Required (move to integration test helpers)

**Agent Assignment**: Should move to `integration-test-architect` - complex auth integration scenarios.

---

### 📁 `/src/components/react-environment.test.tsx`

**Current Classification**: Archetype 1 (Pure Function Unit Test)  
**Target Classification**: Archetype 1  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Simple React environment verification
- **Approach**: Basic React hook testing
- **Complexity**: Low - 2 basic verification tests

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Perfect for `unit-test-architect` - simple environment verification.

---

### 📁 `/src/components/permissions/__tests__/PermissionGate.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Permission component testing with comprehensive scenarios
- **Approach**: Mock permission functions, edge case testing
- **Complexity**: Medium - 8 test groups covering permission logic

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Excellent for `unit-test-architect` - clean permission component testing.

---

### 📁 `/src/components/permissions/__tests__/PermissionButton.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Component testing with MUI mocks and permission logic
- **Approach**: Mock MUI components, test permission-based rendering
- **Complexity**: Medium - 6 test groups with accessibility testing

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Great fit for `unit-test-architect` - demonstrates component mocking patterns.

---

### 📁 `/src/hooks/__tests__/usePermissions.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: React hook testing with VitestTestWrapper
- **Approach**: Hook testing with provider context
- **Complexity**: Medium - 3 hooks tested with various scenarios

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No (using VitestTestWrapper)
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Perfect for `unit-test-architect` - demonstrates proper hook testing.

---

### 📁 `/src/lib/environment-client/__tests__/client-safe-access.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 1 (Pure Function Unit Test)  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Environment variable access testing with component rendering
- **Approach**: TDD approach with mock environment variables
- **Complexity**: Low - 4 test cases for environment access

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: Yes (separate function tests from component tests)
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Good for `unit-test-architect` with pattern cleanup to separate pure function tests.

---

### 📁 `/src/components/machines/__tests__/MachineDetailView.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Auth integration testing with permission mocking
- **Approach**: Real component testing with targeted permission mocks
- **Complexity**: High - Multi-tenant auth scenarios with edge cases

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No (already implemented)
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Excellent for `unit-test-architect` - demonstrates advanced auth integration testing.

---

### 📁 `/src/components/locations/__tests__/LocationDetailView.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Component testing with real component integration
- **Approach**: Auth scenarios with permission-based UI changes
- **Complexity**: Medium - Permission-based rendering with edge cases

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No (already implemented)
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Great for `unit-test-architect` - clean component testing with auth integration.

---

### 📁 `/src/app/issues/__tests__/page.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Server Component with auth integration testing
- **Approach**: Real component testing with external API mocks
- **Complexity**: Medium - Auth scenarios with component interaction

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No (already implemented)
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Good for `unit-test-architect` - structured auth integration testing.

---

### 📁 `/src/app/issues/__tests__/issues-page-auth-integration.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Auth integration testing with minimal external mocks
- **Approach**: Real auth context with component interactions
- **Complexity**: Medium - Multi-role auth scenarios

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No (already implemented)
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Excellent for `unit-test-architect` - demonstrates proper auth integration patterns.

---

### 📁 `/src/components/locations/__tests__/MachineGrid.test.tsx`

**Current Classification**: Archetype 4 (React Component Unit Test)  
**Target Classification**: Archetype 4  
**Target Agent**: `unit-test-architect`  
**Confidence**: High

**Analysis**:
- **Pattern**: Component testing with search functionality and navigation
- **Approach**: User interaction testing with semantic queries
- **Complexity**: Medium - Search, navigation, and edge case testing

**Required Changes**:
- Memory safety issues: No
- Archetype conversion needed: No
- Mocking pattern updates: Not Required
- RLS session context needed: No
- Import path changes: Not Required
- Test helper migration: Not Required

**Agent Assignment**: Perfect for `unit-test-architect` - clean component testing with user interactions.

---

## Priority Recommendations

### High Priority (Phase 3 Immediate)

1. **`IssueList.unit.test.tsx`** - Split mixed unit/integration concerns
2. **`IssueList.integration.test.tsx`** - Move to integration archetype  
3. **`client-safe-access.test.tsx`** - Separate function tests from component tests

### Medium Priority (Phase 3 Later)

4. **Standardize mock patterns** across all component tests
5. **Add archetype documentation** to test files
6. **Create component testing templates** for consistent patterns

### Low Priority (Phase 4 Cleanup)

7. **Consolidate similar test patterns** across machine/location components
8. **Add performance testing** for complex components
9. **Create accessibility testing** standards

---

## Agent Assignment Summary

| Agent | File Count | Files |
|-------|------------|-------|
| `unit-test-architect` | 17 | Most component and page tests |
| `integration-test-architect` | 1 | IssueList.integration.test.tsx |
| **Total** | **18** | **Ready for Phase 3** |

**Confidence Distribution**:
- High Confidence: 16 files (89%)
- Medium Confidence: 2 files (11%)
- Low Confidence: 0 files (0%)

---

## Migration Strategy

### Phase 3.1: Immediate Archetype Alignment
1. Split `IssueList.unit.test.tsx` into pure unit tests
2. Move `IssueList.integration.test.tsx` to integration archetype
3. Refactor `client-safe-access.test.tsx` pattern separation

### Phase 3.2: Pattern Standardization  
1. Apply unit-test-architect templates to all component tests
2. Standardize VitestTestWrapper usage patterns
3. Create archetype documentation headers

### Phase 3.3: Validation & Cleanup
1. Verify all tests pass with new patterns
2. Update test utilities for consistency
3. Document component testing best practices

This analysis provides a solid foundation for Phase 3 test architecture implementation with clear archetype classifications and migration paths.