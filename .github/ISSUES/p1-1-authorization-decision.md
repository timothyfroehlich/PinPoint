# [P1] DECISION NEEDED: Clarify Authorization Model

**Priority:** P1 - High (Design Decision Required)
**Effort:** 4-8 hours (if implementing) OR 30 minutes (if documenting)
**Parent Issue:** Security Review Main Issue

## Problem

The application has **NO authorization checks** on critical mutation operations. Any authenticated user can modify ANY issue in the system.

**Affected Actions:**
- `updateIssueStatusAction` (src/app/(app)/issues/actions.ts:160)
- `updateIssueSeverityAction` (src/app/(app)/issues/actions.ts:263)
- `assignIssueAction` (src/app/(app)/issues/actions.ts:369)
- `addCommentAction` (src/app/(app)/issues/actions.ts:479)

**Current Behavior:**
```typescript
export async function updateIssueStatusAction(formData: FormData): Promise<void> {
  // ✅ Has authentication check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ❌ NO authorization check - ANY authenticated user can modify ANY issue
  await db.update(issues)
    .set({ status })
    .where(eq(issues.id, issueId));
}
```

**What ANY authenticated user can do:**
- Change status/severity of issues they don't own
- Assign issues to anyone (including themselves)
- Add comments to any issue
- Modify resolved issues

**Reference:** Section 1.2 (High Priority Issue #1) of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

## 🤔 Critical Question

**Is this behavior intentional for the single-tenant collaborative model?**

### Context from Architecture Docs

From `docs/TECH_SPEC.md`:
> **Single-Tenant**: One organization (Austin Pinball Collective), no multi-tenant complexity, no organization scoping required, no RLS policies.

From `AGENTS.md`:
> **Core Value**: "Allow the Austin Pinball Collective to log issues with pinball machines, track work and resolve them."

## Decision Options

### Option A: Keep Current Behavior (Collaborative Model)

**Rationale:** All users are trusted members of the Austin Pinball Collective. Everyone should be able to work on any issue.

**If this is the design:**
- ✅ No code changes needed
- ✅ Fully collaborative environment
- ✅ Simple mental model
- ⚠️ Document this explicitly in code

**Action Required:**
Add comments to all affected Server Actions:

```typescript
/**
 * Update Issue Status Action
 *
 * SECURITY NOTE: Single-tenant collaborative design - all authenticated
 * users can modify all issues. This is intentional for the Austin Pinball
 * Collective where all members are trusted to work on any machine issue.
 *
 * If multi-tenant support is added in the future, authorization checks
 * MUST be added here (check user is reporter, assignee, or admin).
 */
export async function updateIssueStatusAction(...)
```

### Option B: Implement Authorization Checks

**Rationale:** Users should only modify issues they own or are assigned to. Admins can modify anything.

**If this is needed:**
- ⚠️ Requires implementing authorization checks
- ⚠️ Need to define permission model
- ✅ Better security posture
- ✅ Audit trail (know who can do what)

**Action Required:**
Implement authorization pattern:

```typescript
// Add helper function
async function canModifyIssue(userId: string, issueId: string): Promise<boolean> {
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { reportedBy: true, assignedTo: true },
  });

  if (!issue) return false;

  // Get user role
  const user = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  });

  // Admin can modify anything
  if (user?.role === "admin") return true;

  // Reporter or assignee can modify
  return issue.reportedBy === userId || issue.assignedTo === userId;
}

// Use in Server Actions
export async function updateIssueStatusAction(formData: FormData): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ADD: Authorization check
  const hasPermission = await canModifyIssue(user.id, issueId);
  if (!hasPermission) {
    await setFlash({
      type: "error",
      message: "You don't have permission to modify this issue"
    });
    redirect(`/issues/${issueId}`);
  }

  // ... rest of logic
}
```

## Risk Assessment

### Current Risk (No Authorization)

**For Single-Tenant MVP (Option A):**
- Risk: LOW
- All users are trusted organization members
- No untrusted users in system
- Acceptable for current scope

**For Future Multi-Tenant or Public Access:**
- Risk: CRITICAL
- Horizontal privilege escalation vulnerability
- Users could modify other users' data
- Regulatory/compliance issues

## Acceptance Criteria

### If Option A (Collaborative Model):
- [ ] Decision documented in this issue
- [ ] Code comments added to all affected Server Actions
- [ ] Design decision documented in `docs/NON_NEGOTIABLES.md`
- [ ] Future migration path documented if multi-tenant planned

### If Option B (Implement Authorization):
- [ ] Permission model defined (who can modify what)
- [ ] `canModifyIssue()` helper function implemented
- [ ] Authorization checks added to all mutation actions
- [ ] Tests added for authorization logic
- [ ] Role-based permissions documented

## Testing (If Implementing Option B)

```typescript
// Test: User cannot modify issues they don't own
test("updateIssueStatusAction - unauthorized user rejected", async () => {
  const userA = await createTestUser("userA@test.com");
  const userB = await createTestUser("userB@test.com");

  const issue = await createIssue({ reportedBy: userA.id });

  // Try to modify as userB (not reporter, not assignee)
  await expect(
    updateIssueStatusAction(formDataWithIssueId(issue.id))
  ).rejects.toThrow("Permission denied");
});

// Test: Admin can modify any issue
test("updateIssueStatusAction - admin can modify", async () => {
  const admin = await createTestUser("admin@test.com", { role: "admin" });
  const member = await createTestUser("member@test.com");

  const issue = await createIssue({ reportedBy: member.id });

  // Admin should be able to modify member's issue
  await expect(
    updateIssueStatusAction(formDataWithIssueId(issue.id))
  ).resolves.not.toThrow();
});
```

## Files to Modify

### If Option A (Document Only):
- `src/app/(app)/issues/actions.ts` (add comments)
- `docs/NON_NEGOTIABLES.md` (document design decision)

### If Option B (Implement Authorization):
- `src/lib/auth/permissions.ts` (new file - helper functions)
- `src/app/(app)/issues/actions.ts` (add authorization checks to 4 actions)
- `src/test/integration/authorization.test.ts` (new file - tests)
- `docs/NON_NEGOTIABLES.md` (add authorization rule)

## Recommendation

**Option A (Collaborative Model)** is recommended for MVP because:
1. Matches single-tenant architecture
2. All users are trusted organization members
3. Zero implementation effort
4. Can migrate to Option B later if needed

**However**, this decision should be made explicitly by the product owner.

## Labels

`security`, `priority: high`, `decision needed`, `architecture`
