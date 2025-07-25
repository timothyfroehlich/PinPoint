# Task 008: Full System Validation and Testing

**Priority**: HIGH  
**Category**: Validation  
**Status**: Not Started  
**Dependencies**: All other tasks

## Problem

After all changes, need comprehensive validation that:

- All security vulnerabilities are fixed
- Permission system works end-to-end
- No regressions introduced
- Performance is acceptable
- All quality gates pass

## Current State

- Individual components tested
- No full system validation
- No performance benchmarks
- No security audit trail

## Solution

Comprehensive validation suite covering security, functionality, and performance.

## Implementation Steps

### 1. Security Validation

Run security audit:

```bash
# Check for any remaining API routes
find src/app/api -name "*.ts" -not -path "*/auth/*" -not -path "*/trpc/*" -not -path "*/health/*" -not -path "*/qr/*" -not -path "*/dev/*"

# Verify all tRPC procedures have permission checks
rg "publicProcedure" src/server/api/routers/ | grep -v "health"

# Check for any fetch() calls to /api/
rg 'fetch.*"/api/' src/ --type ts --type tsx
```

### 2. Run All Test Suites

**Note**: This is the final validation task. By this point, tests should be passing. If earlier tasks were completed with some failing tests, this is when to fix them.

```bash
# During development, focus on linting first
npm run lint
npm run typecheck

# Then work towards getting tests to pass
npm run test
npm run test:integration
npm run test:e2e

# Final coverage report
npm run test:coverage
```

### 3. Manual Testing Checklist

- [ ] Login as different roles
- [ ] Test permission denials
- [ ] Verify multi-tenant isolation
- [ ] Check all CRUD operations
- [ ] Test error scenarios
- [ ] Verify optimistic updates

### 4. Performance Testing

- Measure API response times
- Check bundle size
- Test with large datasets
- Verify no N+1 queries

### 5. Quality Gates

```bash
# All must pass
npm run validate
npm run pre-commit
npm run validate
```

### 6. Create Audit Report

Document:

- Security vulnerabilities fixed
- Permission coverage metrics
- Test coverage report
- Performance benchmarks
- Known limitations

## Success Criteria

- [ ] Zero security vulnerabilities
- [ ] 100% permission coverage on procedures
- [ ] All tests passing
- [ ] Performance within targets
- [ ] Clean audit report
- [ ] All quality gates green

## References

### Core Documentation

- Core objectives: `task_list/README.md`
- **Testing Design**: `docs/design-docs/testing-design-doc.md`
- **CLAUDE.md**: Quality standards and commands

### Testing Documentation

- **Test Map**: `docs/architecture/test-map.md`
- **Testing Patterns**: `docs/developer-guides/testing-patterns.md`
- **Coverage Setup**: `docs/coverage-setup.md`

### Commands Reference

```bash
# Quick validation
npm run quick

# Full validation
npm run pre-commit

# Debug commands
npm run debug:typecheck
npm run debug:test
npm run debug:lint

# Coverage
npm run test:coverage
```

### Validation Checklist

1. **Security**: No unauthorized access possible
2. **Permissions**: All actions properly gated
3. **Multi-tenancy**: Complete organization isolation
4. **UI/UX**: Consistent permission-based states
5. **Performance**: Acceptable response times
6. **Quality**: All linting/formatting rules pass
