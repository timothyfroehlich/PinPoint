# PGlite RLS Testing Proof of Concept Plan

## Objective

Create a minimal, isolated test that definitively proves PGlite v0.3.7 can enforce Row Level Security (RLS) policies for cross-organizational data isolation.

## Background Research Findings

- **PGlite v0.3.7**: Current version in package.json
- **GitHub Issue #274**: RLS bug was **fixed in v0.2.9** (we're on v0.3.7)
- **Current Architecture**: Dual-track testing with Track 2 intentionally bypassing RLS
- **Hypothesis**: PGlite CAN enforce RLS, but current tests bypass it by design

## Test Strategy

### Phase 1: Minimal RLS Setup (10 minutes)

1. **Create standalone test file**: `test-pglite-rls-proof.test.ts`
2. **Fresh PGlite instance**: No existing test infrastructure dependencies
3. **Manual RLS setup**: Avoid current test helpers that bypass RLS
4. **Single table focus**: Use `issues` table for simplicity

### Phase 2: RLS Policy Implementation (15 minutes)

1. **Enable RLS on issues table**:

   ```sql
   ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
   ```

2. **Create organizational isolation policy**:

   ```sql
   CREATE POLICY "issues_org_isolation" ON issues
   USING (organization_id = current_setting('app.current_organization_id', true));
   ```

3. **Create test role** (not BYPASSRLS):
   ```sql
   CREATE ROLE test_user;
   ```

### Phase 3: Cross-Org Data Test (15 minutes)

1. **Create two organizations**:
   - "test-org-primary"
   - "test-org-competitor"

2. **Create issues in both orgs**:
   - Issue A in primary org
   - Issue B in competitor org

3. **Test RLS enforcement**:
   - Set session: `SET app.current_organization_id = 'test-org-primary'`
   - Query all issues
   - **Expected**: Only Issue A visible, Issue B blocked by RLS
   - Switch context to competitor org
   - **Expected**: Only Issue B visible, Issue A blocked by RLS

### Phase 4: Validation (10 minutes)

1. **Verify RLS is active**: Check `pg_policies` table has our policy
2. **Verify cross-org blocking**: Assert queries return filtered results
3. **Verify context switching works**: Same data, different org contexts
4. **Performance check**: Ensure RLS doesn't break functionality

## Success Criteria

### ✅ Pass Conditions

- [ ] PGlite instance creates successfully with RLS enabled
- [ ] RLS policies can be created and are active
- [ ] Cross-org queries return ZERO results (blocked by RLS)
- [ ] Same-org queries return expected data
- [ ] Session context switching works correctly
- [ ] No application-level filtering needed - pure database enforcement

### ❌ Fail Conditions

- PGlite throws errors when enabling RLS
- RLS policies are ignored (cross-org data visible)
- Session variables don't affect query results
- Database crashes or becomes unstable

## Implementation Details

### Test File Structure

```typescript
describe("PGlite RLS Proof of Concept", () => {
  test("proves PGlite can enforce cross-org RLS policies", async () => {
    // 1. Create fresh PGlite (no existing test helpers)
    // 2. Apply schema + RLS policies manually
    // 3. Create test data in 2 orgs
    // 4. Test cross-org isolation
    // 5. Verify RLS enforcement works
  });
});
```

### Expected Test Output

```
✅ PGlite RLS Proof of Concept
  ✅ proves PGlite can enforce cross-org RLS policies
    - Created PGlite instance with RLS support
    - Applied RLS policies successfully
    - Primary org user sees 1 issue (own org only)
    - Competitor org user sees 1 issue (own org only)
    - Cross-org access blocked by database-level RLS
    - NO application-level filtering required
```

## Risk Mitigation

### If Test Passes ✅

- **Conclusion**: PGlite RLS works perfectly
- **Root Cause**: Current architecture bypasses RLS by design (Track 2)
- **Solution**: Use Track 1 (RLS-enabled) for security tests
- **Next Steps**: Fix test configuration, not RLS implementation

### If Test Fails ❌

- **Investigation needed**: Check PGlite version compatibility
- **Fallback plan**: Use external PostgreSQL for RLS testing only
- **Architecture adjustment**: Keep Track 2 for business logic, add Track 3 for RLS

## Timeline

- **Total time**: ~50 minutes
- **Phase 1-3**: Implementation (40 minutes)
- **Phase 4**: Validation and documentation (10 minutes)

---

**Status**: Ready to implement
**Author**: Claude Code Analysis
**Date**: 2025-08-23
