# [ENHANCEMENT] Implement Role-Based Permissions (1.0)

**Priority:** Future Enhancement (1.0 Release)
**Effort:** ~2 weeks
**Parent Issue:** Security Review Main Issue
**Roadmap:** From PRODUCT_SPEC.md Section "Roles & Permissions" (1.0)

---

## MVP Decision (RESOLVED)

**Decision:** For MVP, all authenticated users have full access (collaborative model).

**Rationale:**
- Single-tenant architecture (Austin Pinball Collective only)
- All users are trusted organization members
- Simplifies MVP implementation
- Can add role-based permissions in 1.0 when needed

**Status:** ✅ Documented and accepted for MVP

---

## 1.0 Feature: Role-Based Permissions

From `docs/PRODUCT_SPEC.md` lines 237-242:

### Role Definitions

**Guest Role** (MVP+)
- **Can:** Report issues only
- **Cannot:** View all issues, edit issues, manage machines, assign issues
- **Use Case:** Public reporters who want to track their submissions
- **Scope:** Read-only access to their own reported issues

**Member Role** (Current Default)
- **Can:** Manage issues, machines, assignments
- **Cannot:** Manage users, roles, system settings
- **Use Case:** Austin Pinball Collective members (technicians, volunteers)
- **Scope:** Full CRUD on issues and machines

**Admin Role** (1.0)
- **Can:** Manage users, roles, system settings
- **Can:** All Member permissions
- **Cannot:** N/A (full access)
- **Use Case:** Organization administrators
- **Scope:** User management, system configuration

---

## Current Schema Support

The schema already has a role field in `user_profiles`:

```typescript
// src/server/db/schema.ts:31-33
role: text("role", { enum: ["guest", "member", "admin"] })
  .notNull()
  .default("member"),
```

**Status:** ✅ Database schema ready

---

## Implementation Plan

### Phase 1: Guest Role (MVP+)

**Estimated Effort:** 3-5 days

#### 1.1 Self-Service Guest Signup
- [ ] Add "Sign up as Guest" option to signup page
- [ ] Default new guest accounts to `role: 'guest'`
- [ ] Guest onboarding flow (simplified)

#### 1.2 Guest Permissions
- [ ] Create `canModifyIssue()` helper in `src/lib/auth/permissions.ts`
- [ ] Add authorization checks to issue mutation actions:
  - `updateIssueStatusAction` - Only member/admin
  - `updateIssueSeverityAction` - Only member/admin
  - `assignIssueAction` - Only member/admin
  - `addCommentAction` - Check if guest can comment on own issues
- [ ] Filter issue list: Guests see only their reported issues
- [ ] Filter dashboard: Guests see only their submitted issues
- [ ] Hide admin actions in UI for guests (edit, delete, assign)

#### 1.3 Guest Issue Reporting
- [ ] Public form creates issues as guest (if logged in) or anonymous
- [ ] Guests can view their submission history
- [ ] Guests can add comments to their own issues
- [ ] Guests cannot change status or severity

**Acceptance Criteria:**
- [ ] Guest can self-signup
- [ ] Guest can report issues
- [ ] Guest can view only their own issues
- [ ] Guest cannot modify issues they don't own
- [ ] Guest cannot access machine management
- [ ] Guest cannot assign issues

---

### Phase 2: Admin Role (1.0)

**Estimated Effort:** 5-7 days

#### 2.1 Admin User Management
- [ ] Create admin dashboard at `/admin`
- [ ] List all users with roles
- [ ] Change user roles (guest ↔ member ↔ admin)
- [ ] Invite new members via email
- [ ] Deactivate/reactivate user accounts
- [ ] View user activity (issues created, resolved)

#### 2.2 Admin Permissions
- [ ] Create `isAdmin()` helper in `src/lib/auth/permissions.ts`
- [ ] Protect admin routes with middleware or layout check
- [ ] Add role management actions:
  - `changeUserRoleAction` - Admin only
  - `deactivateUserAction` - Admin only
  - `inviteUserAction` - Admin only
- [ ] Admins can modify any issue (override guest/member restrictions)
- [ ] Admins can delete machines
- [ ] Admins can bulk archive resolved issues

#### 2.3 Admin System Settings
- [ ] Organization profile (name, logo, contact)
- [ ] Default settings (default severity, auto-assign rules)
- [ ] Email notification preferences (if implemented)
- [ ] Public form settings (enable/disable, required fields)

**Acceptance Criteria:**
- [ ] Admin can manage all users
- [ ] Admin can change user roles
- [ ] Admin can access admin dashboard
- [ ] Admin has full permissions (overrides all restrictions)
- [ ] Admin-only actions protected with role checks
- [ ] Non-admins cannot access admin routes

---

### Phase 3: Permission Helper Library

**Create:** `src/lib/auth/permissions.ts`

```typescript
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles, issues } from "~/server/db/schema";

/**
 * Check if user has admin role
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  });

  return user?.role === "admin";
}

/**
 * Check if user can modify an issue
 *
 * Rules:
 * - Admins can modify any issue
 * - Members can modify any issue (collaborative model)
 * - Guests can only comment on their own issues
 */
export async function canModifyIssue(
  userId: string,
  issueId: string
): Promise<boolean> {
  const user = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  });

  // Admin can modify anything
  if (user?.role === "admin") return true;

  // Member can modify anything (collaborative model)
  if (user?.role === "member") return true;

  // Guest can only view their own issues
  if (user?.role === "guest") {
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { reportedBy: true },
    });

    return issue?.reportedBy === userId;
  }

  return false;
}

/**
 * Check if user can manage machines
 */
export async function canManageMachines(userId: string): Promise<boolean> {
  const user = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  });

  // Only members and admins can manage machines
  return user?.role === "member" || user?.role === "admin";
}

/**
 * Check if user can manage other users
 */
export async function canManageUsers(userId: string): Promise<boolean> {
  return await isAdmin(userId);
}
```

---

## Migration Strategy

### For Existing Users

All existing users default to `role: 'member'` (already in schema default).

**No migration needed** - existing users already have correct role.

### First Admin Setup

**Manual Process** (for MVP → 1.0 transition):

1. Database update to set first admin:
   ```sql
   UPDATE user_profiles
   SET role = 'admin'
   WHERE email = 'tim@example.com';  -- Replace with actual admin email
   ```

2. **OR** Add seed script for local development:
   ```typescript
   // supabase/seed-users.mjs already sets roles
   const TEST_USERS = [
     { email: "admin@test.com", name: "Admin User", role: "admin" },
     { email: "member@test.com", name: "Member User", role: "member" },
     { email: "guest@test.com", name: "Guest User", role: "guest" },
   ];
   ```

**Production Setup:**
- First user to sign up is automatically admin
- OR admin manually promotes first user via database update
- Admin can then promote/demote other users via UI

---

## Testing Requirements

### Guest Role Tests

```typescript
// Test: Guest cannot modify issues
test("Guest cannot change issue status", async () => {
  const guest = await createTestUser("guest@test.com", { role: "guest" });
  const member = await createTestUser("member@test.com");

  const issue = await createIssue({ reportedBy: member.id });

  // Authenticate as guest
  await expect(
    updateIssueStatusAction(formData(issue.id, "resolved"))
  ).rejects.toThrow("Permission denied");
});

// Test: Guest can view own issues only
test("Guest sees only their own issues", async () => {
  const guest = await createTestUser("guest@test.com", { role: "guest" });
  const member = await createTestUser("member@test.com");

  await createIssue({ reportedBy: guest.id, title: "Guest Issue" });
  await createIssue({ reportedBy: member.id, title: "Member Issue" });

  // Authenticate as guest
  const issues = await getIssues();

  expect(issues).toHaveLength(1);
  expect(issues[0].title).toBe("Guest Issue");
});
```

### Admin Role Tests

```typescript
// Test: Admin can modify any issue
test("Admin can modify any issue", async () => {
  const admin = await createTestUser("admin@test.com", { role: "admin" });
  const member = await createTestUser("member@test.com");

  const issue = await createIssue({ reportedBy: member.id });

  // Authenticate as admin
  await expect(
    updateIssueStatusAction(formData(issue.id, "resolved"))
  ).resolves.not.toThrow();
});

// Test: Non-admin cannot access admin routes
test("Non-admin cannot access admin dashboard", async () => {
  const member = await createTestUser("member@test.com");

  await expect(
    fetch("/admin", { headers: { cookie: memberSession } })
  ).rejects.toThrow("Forbidden");
});
```

### Permission Helper Tests

```typescript
test("canModifyIssue - admin can modify any issue", async () => {
  const admin = await createTestUser("admin@test.com", { role: "admin" });
  const issue = await createIssue({ reportedBy: "other-user" });

  const canModify = await canModifyIssue(admin.id, issue.id);
  expect(canModify).toBe(true);
});

test("canModifyIssue - member can modify any issue", async () => {
  const member = await createTestUser("member@test.com");
  const issue = await createIssue({ reportedBy: "other-user" });

  const canModify = await canModifyIssue(member.id, issue.id);
  expect(canModify).toBe(true);  // Collaborative model
});

test("canModifyIssue - guest can only modify own issues", async () => {
  const guest = await createTestUser("guest@test.com", { role: "guest" });
  const ownIssue = await createIssue({ reportedBy: guest.id });
  const otherIssue = await createIssue({ reportedBy: "other-user" });

  expect(await canModifyIssue(guest.id, ownIssue.id)).toBe(true);
  expect(await canModifyIssue(guest.id, otherIssue.id)).toBe(false);
});
```

---

## UI Changes Required

### Navigation

- Hide "Machines" menu item for guests
- Hide "Admin" menu item for non-admins
- Show "My Issues" for guests (instead of "All Issues")

### Issue Detail Page

- Hide edit buttons for guests (on issues they don't own)
- Hide assign button for guests
- Show "Reported by you" badge for guest's own issues

### Machine List

- Hide "Add Machine" button for guests
- Hide edit/delete buttons for guests

### Dashboard

- Guest dashboard shows only their submitted issues
- Member dashboard shows all issues
- Admin dashboard includes admin panel link

---

## Files to Create/Modify

### New Files
- `src/lib/auth/permissions.ts` (permission helper functions)
- `src/app/(app)/admin/layout.tsx` (admin layout with auth check)
- `src/app/(app)/admin/page.tsx` (admin dashboard)
- `src/app/(app)/admin/users/page.tsx` (user management)
- `src/app/(app)/admin/actions.ts` (admin Server Actions)
- `src/test/integration/permissions.test.ts` (permission tests)

### Modified Files
- `src/app/(app)/issues/actions.ts` (add authorization checks)
- `src/app/(app)/machines/actions.ts` (add authorization checks)
- `src/components/Navigation.tsx` (role-based menu items)
- `src/app/(app)/issues/page.tsx` (filter by role)
- `src/app/(app)/dashboard/page.tsx` (role-based dashboard)

---

## Documentation Updates

### Update NON_NEGOTIABLES.md

Add authorization rule:

```markdown
**CORE-SEC-003:** Enforce role-based authorization

- **Severity:** Critical (for 1.0)
- **Why:** Prevent unauthorized access to admin features
- **Do:** Check user role before sensitive operations
- **Don't:** Skip role checks in admin actions
```

### Update PRODUCT_SPEC.md

Mark roles as implemented in 1.0.

---

## Rollout Strategy

### MVP+ (Guest Role)
1. Deploy guest role with permission checks
2. Test with beta users
3. Announce self-service guest signup
4. Monitor for permission bypasses

### 1.0 (Admin Role)
1. Deploy admin role and admin dashboard
2. Manually promote first admin via database
3. Admin promotes other admins via UI
4. Test all permission boundaries
5. Full production release

---

## Dependencies

- ✅ Database schema already supports roles
- ⚠️ Requires decision on first admin setup process
- ⚠️ May require email invitation system for admin user invites

---

## Success Criteria

### Guest Role (MVP+)
- [ ] Guests can self-signup
- [ ] Guests see only their own issues
- [ ] Guests cannot modify others' issues
- [ ] Guests cannot access machine management
- [ ] Permission checks prevent bypass

### Admin Role (1.0)
- [ ] Admin can manage all users
- [ ] Admin can change user roles
- [ ] Admin can access admin dashboard
- [ ] Non-admins cannot access admin routes
- [ ] Admin has full system access

---

## Security Considerations

1. **Authorization Checks:** Every Server Action must check permissions
2. **UI Hiding ≠ Security:** Always enforce on server, not just UI
3. **Admin Audit Trail:** Log all admin actions (user management, role changes)
4. **First Admin Security:** Protect first admin promotion process
5. **Role Escalation:** Prevent users from promoting themselves

---

## References

- **Product Spec:** `docs/PRODUCT_SPEC.md` lines 237-242 (Roles & Permissions)
- **Roadmap:** `docs/V2_ROADMAP.md` lines 105-111 (Guest Accounts)
- **Current Schema:** `src/server/db/schema.ts:31-33` (role field)
- **Security Review:** `SECURITY_REVIEW_2025-11-25.md` Section 1.2

---

## Labels

`enhancement`, `1.0`, `security`, `roles`, `permissions`, `admin`

---

## Notes for Implementation

- Start with Guest role (MVP+) - simpler and higher priority
- Admin role can wait until 1.0
- Permission helper library is shared across both phases
- Consider this a gradual rollout: MVP → MVP+ (Guest) → 1.0 (Admin)
