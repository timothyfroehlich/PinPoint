# Task: Review Agent - Roles and Permissions System

## Mission Statement

Review the roles and permissions implementation for correctness, security, performance, and adherence to design specifications. Ensure the RBAC system is robust and ready for production.

## Context

- Implementation follows `/docs/design-docs/roles-permissions-design.md`
- Test agent wrote comprehensive tests
- Implementation agent built the system
- Beta release focus: System roles + Member template
- Critical security component requiring thorough review

## Review Checklist

### 1. Design Compliance

- [ ] System roles (Admin, Unauthenticated) are truly immutable
- [ ] Admin role cannot be modified in any way
- [ ] Unauthenticated role permissions can be customized
- [ ] Member template created with correct default permissions
- [ ] Permission dependencies automatically included
- [ ] Organization always has at least one admin

### 2. Security Review

#### Permission Checks

- [ ] All protected routes check permissions
- [ ] Permission checks cannot be bypassed
- [ ] Admin role truly has all permissions
- [ ] Unauthenticated permissions properly limited
- [ ] No permission escalation vulnerabilities

#### Data Integrity

- [ ] Cannot delete last admin user
- [ ] Cannot change last admin's role
- [ ] Role deletion handles user reassignment
- [ ] Orphaned data prevention
- [ ] Transaction rollback on failures

### 3. Code Quality

#### Type Safety

- [ ] All permission strings use constants
- [ ] Role types properly defined
- [ ] No `any` types used
- [ ] Proper error types

#### Error Handling

- [ ] Clear error messages for users
- [ ] Proper HTTP status codes
- [ ] Graceful degradation
- [ ] No sensitive data in errors

#### Testing

- [ ] All tests passing
- [ ] Good test coverage
- [ ] Edge cases tested
- [ ] Integration tests work

### 4. Performance Review

- [ ] Permission checks are efficient
- [ ] No N+1 queries
- [ ] Proper database indexes
- [ ] Role queries optimized
- [ ] Caching opportunities identified

### 5. Database Review

#### Schema

```typescript
// Verify these aspects:
- Role.organizationId is required
- Role unique constraint on [organizationId, name]
- Member.roleId properly indexed
- Cascade deletes configured correctly
- JSON permissions field appropriate
```

#### Migrations

- [ ] Schema changes applied cleanly
- [ ] Seed data works correctly
- [ ] No data loss on updates
- [ ] Rollback plan exists

### 6. API Review

#### Endpoints

- [ ] List roles includes member counts
- [ ] Update role validates permissions
- [ ] Delete role handles reassignment
- [ ] Proper authentication required
- [ ] Input validation comprehensive

#### Response Format

- [ ] Consistent error responses
- [ ] Useful error messages
- [ ] Proper status codes
- [ ] No data leakage

### 7. Implementation Details

#### Role Service

- [ ] Transaction handling correct
- [ ] Permission dependency logic sound
- [ ] Admin safety checks work
- [ ] Template creation accurate

#### Permission Service

- [ ] hasPermission logic correct
- [ ] Unauthenticated handling works
- [ ] Admin bypass implemented
- [ ] Caching considered

### 8. Integration Points

#### Organization Creation

- [ ] Atomic transaction for all steps
- [ ] Proper error handling
- [ ] Creator becomes admin
- [ ] All roles created

#### Member Management

- [ ] New members get default role
- [ ] Role changes validated
- [ ] Permission updates immediate

### 9. Future Compatibility

- [ ] V1.0 templates can be added easily
- [ ] Migration path clear
- [ ] No breaking changes planned
- [ ] Extension points identified

### 10. Documentation Needs

- [ ] Code comments adequate
- [ ] API documentation needed
- [ ] Migration guide required
- [ ] Admin guide necessary

## Specific Areas to Review

### Critical Security Functions

1. `ensureAtLeastOneAdmin()` - Verify bulletproof
2. `hasPermission()` - Check all paths
3. Role deletion - Confirm safe reassignment
4. Permission dependencies - Validate logic

### Performance Hotspots

1. Permission checks on every request
2. Role queries with member counts
3. Bulk permission updates
4. Organization creation transaction

### Edge Cases

1. Concurrent admin removal attempts
2. Role deletion with many members
3. Circular permission dependencies
4. Missing default role scenario

## Review Process

### 1. Static Analysis

- Run linters
- Check type coverage
- Analyze complexity
- Security scan

### 2. Dynamic Testing

- Run all tests
- Manual testing of flows
- Load testing permissions
- Chaos testing admin removal

### 3. Code Inspection

- Line-by-line review
- Logic verification
- Security audit
- Performance analysis

## Recommendations Format

When complete, provide:

1. **Critical Issues**: Must fix before merge
2. **Important Issues**: Should fix soon
3. **Minor Issues**: Nice to have
4. **Suggestions**: Future improvements

## Success Criteria

- [ ] All design requirements met
- [ ] No security vulnerabilities found
- [ ] Performance acceptable
- [ ] Code quality high
- [ ] Tests comprehensive
- [ ] Ready for production

## Completion Instructions

When your review is complete:

1. Create review summary in `review-summary.md`
2. Log any critical issues found
3. Suggest specific improvements
4. Run final validation
5. Commit: `git commit -m "review: comprehensive review of RBAC implementation"`
6. Push: `git push`
7. Add review comments to PR
8. Notify the orchestrator with findings
9. DO NOT clean up the worktree yourself
