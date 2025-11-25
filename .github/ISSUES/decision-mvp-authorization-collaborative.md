# [DECISION] MVP Authorization Model: Collaborative (All Users Can Modify All Issues)

**Decision Date:** November 25, 2025
**Status:** ✅ RESOLVED - Collaborative Model Accepted for MVP
**Related:** Security Review P1-1, Enhancement: Role-Based Permissions

---

## Decision

**For MVP, all authenticated users have full access to modify all issues and machines.**

This is a **collaborative model** where all members of the Austin Pinball Collective are trusted to work on any issue.

---

## Context

Security review identified that the application has no authorization checks - any authenticated user can modify any issue. This raised the question: is this intentional or a security vulnerability?

**Current Behavior:**
- Any authenticated user can change issue status/severity
- Any authenticated user can assign issues to anyone
- Any authenticated user can add comments to any issue
- Any authenticated user can create/edit machines

**From Architecture Docs:**
- Single-tenant application (Austin Pinball Collective only)
- All users are organization members
- Product spec shows "Single role: **Member** (full access)" for MVP

---

## Rationale

### Why Collaborative Model is Appropriate for MVP

1. **Single-Tenant Architecture**
   - One organization (Austin Pinball Collective)
   - All users are trusted members
   - No untrusted users in the system

2. **Product Spec Alignment**
   - `docs/PRODUCT_SPEC.md` lines 54-61 explicitly states:
     - **Included:** Single role: **Member** (full access)
     - **Not Included:** Guest role (MVP+), Admin role (1.0)

3. **Use Case**
   - Collaborative repair environment
   - Members help each other fix machines
   - No reason to restrict who can work on what issue

4. **Simplicity**
   - No complex permission logic needed for MVP
   - Faster time to market
   - Can add role-based permissions later (1.0)

---

## Risks Acknowledged

### Current Risk: LOW
- All users are trusted organization members
- Single-tenant architecture
- No multi-tenant concerns
- No untrusted users

### Future Risk: CRITICAL (if architecture changes)
- Would be CRITICAL for multi-tenant application
- Would be HIGH if adding untrusted guest users
- Migration path exists (see enhancement issue)

---

## Code Documentation Required

To make this design decision explicit and prevent future confusion, add comments to all Server Actions that modify issues:

**Example:**
```typescript
/**
 * Update Issue Status Action
 *
 * AUTHORIZATION MODEL: Single-tenant collaborative design.
 *
 * For MVP, all authenticated users (members) can modify all issues.
 * This is intentional for the Austin Pinball Collective where all
 * members are trusted to work on any machine issue.
 *
 * FUTURE: When Guest role is added (MVP+) and Admin role (1.0),
 * implement permission checks using src/lib/auth/permissions.ts
 *
 * See: .github/ISSUES/enhancement-role-based-permissions.md
 */
export async function updateIssueStatusAction(formData: FormData): Promise<void> {
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized" });
    redirect("/login");
  }

  // NO authorization check - collaborative model (all members can modify)

  // ... rest of logic
}
```

---

## Files Requiring Documentation

Add comments to these Server Actions:

**Issue Actions:** `src/app/(app)/issues/actions.ts`
- [ ] `updateIssueStatusAction` (line 160)
- [ ] `updateIssueSeverityAction` (line 263)
- [ ] `assignIssueAction` (line 369)
- [ ] `addCommentAction` (line 479)

**Machine Actions:** `src/app/(app)/machines/actions.ts`
- [ ] `createMachineAction` (if authorization added later)

---

## NON_NEGOTIABLES.md Update

Update `docs/NON_NEGOTIABLES.md` to document this decision:

```markdown
**CORE-SEC-001:** Protect APIs and Server Actions

- **Severity:** Critical
- **Why:** Prevent unauthorized access
- **Do:** Verify authentication in Server Actions and tRPC procedures
- **Don't:** Skip auth checks in protected routes

**Authorization Note (MVP):** Single-tenant collaborative model - all
authenticated users (members) can modify all issues and machines. This
is intentional for Austin Pinball Collective where all members are
trusted organization members.

**Future:** When Guest role (MVP+) and Admin role (1.0) are implemented,
add authorization checks per enhancement-role-based-permissions.md
```

---

## Future Migration Path

When adding role-based permissions (MVP+ for Guest, 1.0 for Admin):

1. **Create permission helper:** `src/lib/auth/permissions.ts`
2. **Add authorization checks** to all mutation Server Actions
3. **Implement role-based UI** (hide buttons based on role)
4. **Test permission boundaries** thoroughly
5. **Update documentation** to reflect new authorization model

See: `.github/ISSUES/enhancement-role-based-permissions.md`

---

## Acceptance Criteria for This Decision

- [x] Decision documented in this issue
- [ ] Code comments added to affected Server Actions
- [ ] NON_NEGOTIABLES.md updated with authorization note
- [ ] Enhancement issue created for future role-based permissions
- [ ] Security review updated to reflect resolved decision

---

## Implementation Checklist

### Documentation (30 minutes)

- [ ] Add authorization model comments to `updateIssueStatusAction`
- [ ] Add authorization model comments to `updateIssueSeverityAction`
- [ ] Add authorization model comments to `assignIssueAction`
- [ ] Add authorization model comments to `addCommentAction`
- [ ] Update `docs/NON_NEGOTIABLES.md` with authorization note
- [ ] Link to enhancement issue in comments

### No Code Changes Required

✅ Current behavior is correct for MVP

---

## Testing

**No new tests required** - collaborative model is the current behavior.

When implementing role-based permissions (future), add authorization tests per enhancement issue.

---

## References

- **Security Review:** `SECURITY_REVIEW_2025-11-25.md` Section 1.2
- **Product Spec:** `docs/PRODUCT_SPEC.md` lines 54-61, 237-242
- **Enhancement Issue:** `.github/ISSUES/enhancement-role-based-permissions.md`
- **Schema:** `src/server/db/schema.ts:31-33` (role field ready for future use)

---

## Labels

`decision`, `documentation`, `security`, `good first issue`

---

## Related Issues

- **Enhancement:** Role-Based Permissions (1.0) - See `enhancement-role-based-permissions.md`
- **Security Review:** P1-1 Authorization Decision (RESOLVED by this issue)
