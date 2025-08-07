# Technical Debt Tracking

This document tracks technical debt items identified during Phase 2A Drizzle Foundation implementation and PR review process.

## High Priority Items

### 1. Frontend TODO Items - Component Functionality

**Issue Type**: Enhancement  
**Priority**: Medium  
**Affected Files**:

- `src/components/issues/IssueActions.tsx` (lines 207, 220, 304, 337)
- `src/components/issues/IssueList.tsx` (lines 277, 304)
- `src/components/issues/IssueStatusControl.tsx` (line 155)

**Description**: Multiple frontend components have placeholder TODO comments for missing functionality including:

- Audit log implementation
- Delete functionality
- Bulk operations (assign, close)
- Status change history
- User assignment dialogs

**Timeline**: Post-Phase 2B (after router migrations complete)
**Estimated Effort**: 2-3 sprints

### 2. Machine & Location Management TODOs

**Issue Type**: Enhancement  
**Priority**: Medium  
**Affected Files**:

- `src/components/locations/LocationDetailView.tsx` (lines 72, 87, 124)
- `src/components/machines/MachineDetailView.tsx` (lines 77, 94, 368, 387)

**Description**: Management interfaces missing key functionality:

- Edit dialogs for locations and machines
- PinballMap sync integration
- QR code generation
- Machine statistics display

**Timeline**: Phase 3 (RLS implementation)
**Estimated Effort**: 1-2 sprints

### 3. Production Environment Overrides

**Issue Type**: Technical Debt  
**Priority**: High  
**Affected Files**:

- `src/lib/temp-production-overrides.ts` (line 11)
- `src/lib/environment.ts` (line 75)

**Description**: Temporary production override files that should be removed after successful deployment verification.

**Timeline**: Immediate (post-deployment verification)
**Estimated Effort**: 1 day

### 4. Admin Router Email Integration

**Issue Type**: Enhancement  
**Priority**: Medium  
**Affected Files**:

- `src/server/api/routers/admin.ts` (line 385)

**Description**: Invitation email sending not implemented in admin router.

**Timeline**: Phase 2C (email service integration)
**Estimated Effort**: 3-5 days

## Code Quality Items

### 5. Mock Data Replacement

**Issue Type**: Technical Debt  
**Priority**: Medium  
**Affected Files**:

- `src/components/issues/IssueCreateForm.tsx` (line 72)

**Description**: Components using mock data that should be replaced with actual API calls.

**Timeline**: Phase 2B (during router migrations)
**Estimated Effort**: 1-2 days per component

## Migration-Specific Items

### 6. Global Variable Pattern in Drizzle Client

**Issue Type**: Code Quality  
**Priority**: Low  
**Source**: PR Review Comment  
**Affected Files**:

- `src/server/db/drizzle.ts`

**Description**: Global variable declarations causing potential type pollution. Consider using controlled singleton pattern.

**Timeline**: Phase 2B cleanup
**Estimated Effort**: 2-3 hours

### 7. MSW Setup Documentation

**Issue Type**: Documentation  
**Priority**: Low  
**Source**: PR Review Comment  
**Affected Files**:

- `src/test/vitest.setup.ts`

**Description**: Complex MSW setup needs documentation explaining why nullable initialization and dynamic imports are necessary.

**Timeline**: Phase 2B (test improvements)
**Estimated Effort**: 1-2 hours

## Tracking Guidelines

### Issue Creation Template

```markdown
## Description

[Clear description of the technical debt item]

## Affected Files

- `path/to/file.ts` (line X)

## Priority Justification

[Why this priority level]

## Implementation Plan

[Step-by-step approach]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Timeline

Target: [Sprint/Phase]
Estimated Effort: [Hours/Days]
```

### Priority Levels

- **High**: Blocks production deployment or causes security/performance issues
- **Medium**: Impacts user experience or developer productivity
- **Low**: Code quality improvements that don't impact functionality

### Review Process

1. Items are reviewed during sprint planning
2. High priority items are scheduled within 2 sprints
3. Medium priority items are scheduled within current phase
4. Low priority items are scheduled for cleanup sprints

## Status Tracking

| Item                 | Status  | Assigned | Target Sprint   |
| -------------------- | ------- | -------- | --------------- |
| Production Overrides | 🔴 Open | -        | Post-deployment |
| Frontend TODOs       | 🔴 Open | -        | Phase 2B        |
| Admin Email          | 🔴 Open | -        | Phase 2C        |
| Global Variables     | 🔴 Open | -        | Phase 2B        |
| MSW Documentation    | 🔴 Open | -        | Phase 2B        |

## Notes

- Items identified during Phase 2A PR review process
- Additional items may be added during ongoing development
- This document should be reviewed and updated monthly
- Consider promoting high-impact low-effort items for quick wins

---

**Last Updated**: 2025-01-07  
**Reviewed By**: PR Review Process  
**Next Review**: Phase 2B Sprint Planning
