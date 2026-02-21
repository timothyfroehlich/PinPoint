# Technician Role Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "technician" role between member and admin that can create/edit machines but has no admin panel access.

**Architecture:** Extend the existing role enum in the DB schema + TypeScript types, add a `technician` column to the permissions matrix, update hardcoded role checks in server actions and UI pages, rename comment permissions from `.edit.own`/`.delete.own` to `.edit`/`.delete`.

**Tech Stack:** Drizzle ORM (migration), TypeScript (strict mode), Vitest (unit/integration tests), Next.js Server Components/Actions, Zod validation schemas.

**Design Document:** `docs/plans/2026-02-20-technician-role-design.md` — contains the full permission matrix.

**Reference Skills:** @tmf-typescript for strict type patterns, @tmf-testing for test patterns, @tmf-patterns for server action patterns.

---

### Task 1: Type System — Add `"technician"` to `UserRole`

**Files:**

- Modify: `src/lib/types/user.ts`

**Step 1: Update USER_ROLES array**

In `src/lib/types/user.ts:5`, change:

```typescript
export const USER_ROLES = ["admin", "member", "guest"] as const;
```

to:

```typescript
export const USER_ROLES = ["admin", "technician", "member", "guest"] as const;
```

The `UserRole` type is derived from this array, so it will automatically include `"technician"`.

**Step 2: Run type check to find all type errors**

Run: `pnpm tsc --noEmit 2>&1 | head -100`

Expected: Type errors in files that use the union `"guest" | "member" | "admin"` literally instead of using the `UserRole` type. These will be fixed in subsequent tasks.

**Step 3: Commit**

```bash
git add src/lib/types/user.ts
git commit -m "feat(roles): add technician to UserRole type"
```

---

### Task 2: Permission Matrix — Add `technician` Access Level + Rename Comment Permissions

**Files:**

- Modify: `src/lib/permissions/matrix.ts`

**Step 1: Update AccessLevel type and constants**

In `src/lib/permissions/matrix.ts:56`, change:

```typescript
export type AccessLevel = "unauthenticated" | "guest" | "member" | "admin";
```

to:

```typescript
export type AccessLevel =
  | "unauthenticated"
  | "guest"
  | "member"
  | "technician"
  | "admin";
```

In `src/lib/permissions/matrix.ts:58-63`, change:

```typescript
export const ACCESS_LEVELS = [
  "unauthenticated",
  "guest",
  "member",
  "admin",
] as const;
```

to:

```typescript
export const ACCESS_LEVELS = [
  "unauthenticated",
  "guest",
  "member",
  "technician",
  "admin",
] as const;
```

**Step 2: Add technician to labels and descriptions**

In `ACCESS_LEVEL_LABELS` (line 68), add after `member`:

```typescript
technician: "Technician",
```

In `ACCESS_LEVEL_DESCRIPTIONS` (line 78), add after `member`:

```typescript
technician: "Machine maintenance and full issue management",
```

**Step 3: Update RolePermissions type**

The `RolePermissions` type at line 85 is `Record<AccessLevel, PermissionValue>` — it derives from `AccessLevel` so it will automatically require `technician`. This means every permission entry in the matrix will now require a `technician` value.

**Step 4: Add `technician` to every permission entry**

For each permission in the matrix, add a `technician` value. The design document specifies the exact value for each permission. Here's the complete mapping:

Issues (all same as member):

- `issues.view`: `technician: true`
- `issues.report`: `technician: true`
- `issues.report.status`: `technician: true`
- `issues.report.priority`: `technician: true`
- `issues.report.assignee`: `technician: true`
- `issues.update.severity`: `technician: true`
- `issues.update.frequency`: `technician: true`
- `issues.update.status`: `technician: true`
- `issues.update.priority`: `technician: true`
- `issues.update.assignee`: `technician: true`
- `issues.watch`: `technician: true`

Comments (same as member, plus rename):

- `comments.view`: `technician: true`
- `comments.add`: `technician: true`
- `comments.edit` (renamed from `comments.edit.own`): `technician: true`
- `comments.delete` (renamed from `comments.delete.own`): `technician: true`
- `comments.delete.any`: `technician: false`

Machines (key differentiator — like admin for create/edit):

- `machines.view`: `technician: true`
- `machines.view.ownerRequirements`: `technician: true`
- `machines.view.ownerNotes`: `technician: "owner"` (owner-only)
- `machines.watch`: `technician: true`
- `machines.create`: `technician: true`
- `machines.edit`: `technician: true`
- `machines.edit.ownerNotes`: `technician: "owner"` (owner-only)

Images:

- `images.upload`: `technician: true`

Admin:

- `admin.access`: `technician: false`
- `admin.users.invite`: `technician: false`
- `admin.users.roles`: `technician: false`

**Step 5: Rename comment permissions**

Change `comments.edit.own` to `comments.edit`:

- Line 273: `id: "comments.edit.own"` → `id: "comments.edit"`
- Line 274: `label: "Edit own comments"` → `label: "Edit comments"`
- Line 275: `description: "Modify your own comments"` → `description: "Modify your own comments"`
- Line 278: `guest: "own"` stays as `"own"`
- Line 279: `member: "own"` → `member: true`
- Add: `technician: true`
- Line 280: `admin: true` stays

Change `comments.delete.own` to `comments.delete`:

- Line 284: `id: "comments.delete.own"` → `id: "comments.delete"`
- Line 285: `label: "Delete own comments"` → `label: "Delete comments"`
- Line 286: `description: "Remove your own comments"` → `description: "Remove your own comments"`
- Line 289: `guest: "own"` stays as `"own"`
- Line 290: `member: "own"` → `member: true`
- Add: `technician: true`
- Line 291: `admin: true` stays

Also update the matrix header comment (line 13) to include technician in the access levels list, and update the admin description (line 82) to say `"Full system access including user management and comment moderation"`.

Also update the TODO comment at line 18 to remove the rename TODO since we're doing it now.

**Step 6: Run type check**

Run: `pnpm tsc --noEmit 2>&1 | head -100`

Expected: More type errors from files that use `Record<AccessLevel, ...>` or reference old comment permission IDs.

**Step 7: Commit**

```bash
git add src/lib/permissions/matrix.ts
git commit -m "feat(permissions): add technician access level and rename comment permissions"
```

---

### Task 3: Permission Helpers — Update `getAccessLevel` and Denied Reason Messages

**Files:**

- Modify: `src/lib/permissions/helpers.ts`

**Step 1: Update `getAccessLevel` function**

In `src/lib/permissions/helpers.ts:31-36`, change the function signature to accept `"technician"`:

```typescript
export function getAccessLevel(
  role: "guest" | "member" | "admin" | undefined | null
): AccessLevel {
```

to:

```typescript
export function getAccessLevel(
  role: "guest" | "member" | "technician" | "admin" | undefined | null
): AccessLevel {
```

**Step 2: Update `getPermissionDeniedReason`**

In `src/lib/permissions/helpers.ts:134-140`, the denied reason for members currently says "Only admins can perform this action". With technician in between, update:

```typescript
case "role":
  if (accessLevel === "guest") {
    return "Members can perform this action";
  }
  if (accessLevel === "member") {
    return "Only admins can perform this action";
  }
  return "You don't have permission to perform this action";
```

to:

```typescript
case "role":
  if (accessLevel === "guest") {
    return "Members can perform this action";
  }
  if (accessLevel === "member") {
    return "Technicians or admins can perform this action";
  }
  if (accessLevel === "technician") {
    return "Only admins can perform this action";
  }
  return "You don't have permission to perform this action";
```

Note: For members, the denied reason now says "Technicians or admins" because the only permissions members lack that technicians have are machine create/edit. This is accurate.

**Step 3: Commit**

```bash
git add src/lib/permissions/helpers.ts
git commit -m "feat(permissions): update helpers for technician access level"
```

---

### Task 4: Legacy Permissions — Update Role Checks

**Files:**

- Modify: `src/lib/permissions.ts`

**Step 1: Update UserRole type**

In `src/lib/permissions.ts:1`, change:

```typescript
export type UserRole = "guest" | "member" | "admin";
```

to:

```typescript
export type UserRole = "guest" | "member" | "technician" | "admin";
```

**Step 2: Update `canUpdateIssue`**

In `src/lib/permissions.ts:31`, the function checks `user.role === "admin"`. Technicians should also be able to update issues. Change:

```typescript
if (user.role === "admin") return true;
```

to:

```typescript
if (user.role === "admin" || user.role === "technician") return true;
```

**Step 3: Update `canEditIssueTitle`**

In `src/lib/permissions.ts:51-52`, technicians (like members) should be able to edit titles:

```typescript
if (user.role === "admin") return true;
if (user.role === "member") return true;
```

to:

```typescript
if (user.role === "admin") return true;
if (user.role === "technician") return true;
if (user.role === "member") return true;
```

**Step 4: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(permissions): add technician to legacy permission checks"
```

---

### Task 5: Database Schema — Add `"technician"` to Drizzle Enum

**Files:**

- Modify: `src/server/db/schema.ts`

**Step 1: Update user_profiles role enum**

In `src/server/db/schema.ts:53`, change:

```typescript
role: text("role", { enum: ["guest", "member", "admin"] });
```

to:

```typescript
role: text("role", { enum: ["guest", "member", "technician", "admin"] });
```

**Step 2: Update invited_users role enum**

In `src/server/db/schema.ts:79`, change:

```typescript
role: text("role", { enum: ["guest", "member", "admin"] });
```

to:

```typescript
role: text("role", { enum: ["guest", "member", "technician", "admin"] });
```

**Step 3: Generate and review migration**

Run: `pnpm db:generate`

This should produce a migration that adds `"technician"` as a valid value. Since Drizzle uses text columns with application-level enum validation (not Postgres enum types), this migration may be empty or minimal — the constraint is in the TypeScript type, not the DB. Review the generated SQL to confirm.

**Step 4: Apply migration locally**

Run: `pnpm db:migrate`

**Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add technician to role enum in schema"
```

---

### Task 6: Server Actions — Update Hardcoded Role Checks

**Files:**

- Modify: `src/app/(app)/m/actions.ts`
- Modify: `src/app/(app)/m/new/page.tsx`
- Modify: `src/app/(app)/issues/actions.ts`
- Modify: `src/app/report/actions.ts`

**Step 1: Update createMachineAction**

In `src/app/(app)/m/actions.ts:103`, change:

```typescript
if (profile.role !== "admin") {
```

to:

```typescript
if (profile.role !== "admin" && profile.role !== "technician") {
```

Also update the log message at line 107 and error at line 108:

```typescript
log.warn(
  { userId: user.id, action: "createMachineAction" },
  "Unauthorized user attempted to create a machine"
);
return err(
  "UNAUTHORIZED",
  "You must be an admin or technician to create a machine."
);
```

**Step 2: Update updateMachineAction**

In `src/app/(app)/m/actions.ts:265-268`, the where condition uses `profile.role === "admin"`. Change:

```typescript
const whereConditions =
  profile.role === "admin"
    ? eq(machines.id, id)
    : and(eq(machines.id, id), eq(machines.ownerId, user.id));
```

to:

```typescript
const whereConditions =
  profile.role === "admin" || profile.role === "technician"
    ? eq(machines.id, id)
    : and(eq(machines.id, id), eq(machines.ownerId, user.id));
```

**Step 3: Update updateMachineTextField**

In `src/app/(app)/m/actions.ts:568`, change:

```typescript
const isAdmin = profile.role === "admin";
```

to:

```typescript
const isAdminOrTechnician =
  profile.role === "admin" || profile.role === "technician";
```

And in line 580, change:

```typescript
if (!isOwner && !isAdmin) {
```

to:

```typescript
if (!isOwner && !isAdminOrTechnician) {
```

Also update the error message at line 583:

```typescript
"Only the machine owner, technicians, or admins can edit this field.";
```

**Step 4: Update updateMachineAction isOwnerOrAdmin**

In `src/app/(app)/m/actions.ts:287`, change:

```typescript
const isOwnerOrAdmin = profile.role === "admin" || isActualOwner;
```

to:

```typescript
const isOwnerOrAdmin =
  profile.role === "admin" || profile.role === "technician" || isActualOwner;
```

**Step 5: Update machine new page**

In `src/app/(app)/m/new/page.tsx:40-42`, change:

```typescript
const isAdmin = currentUserProfile?.role === "admin";

if (!isAdmin) {
```

to:

```typescript
const canCreateMachine = currentUserProfile?.role === "admin" || currentUserProfile?.role === "technician";

if (!canCreateMachine) {
```

Also update line 93 where `isAdmin` is passed to the form — check if `isAdmin` controls anything beyond create access (like owner selection). Read the create-machine-form.tsx to understand:

- `isAdmin` at line 97 controls whether the OwnerSelect component is shown
- Technicians should also be able to select an owner when creating a machine
- Change the prop: pass `canCreateMachine` instead of `isAdmin`, or rename the prop

In `src/app/(app)/m/new/page.tsx`, replace all uses of `isAdmin` with `canCreateMachine` and pass it to the form as `canSelectOwner={canCreateMachine}` or just keep `isAdmin` as a name if the form prop is `isAdmin`.

Actually, look at the form — it uses `isAdmin` to conditionally render owner selection. Since technicians should also pick owners, the simplest fix: pass `canCreateMachine` and rename the prop in the form from `isAdmin` to `canSelectOwner` (or just pass `true` when role is admin or technician).

In `src/app/(app)/m/new/create-machine-form.tsx:22`, change:

```typescript
isAdmin: boolean;
```

to:

```typescript
canSelectOwner: boolean;
```

And update line 97:

```typescript
{isAdmin && <OwnerSelect users={users} onUsersChange={setUsers} />}
```

to:

```typescript
{canSelectOwner && <OwnerSelect users={users} onUsersChange={setUsers} />}
```

Update the parent page.tsx to pass `canSelectOwner={canCreateMachine}`.

**Step 6: Update machine detail page**

In `src/app/(app)/m/[initials]/page.tsx:152`, the variable `isAdmin` is used. Check how it's used — it's passed to `UpdateMachineForm`. Read `src/app/(app)/m/[initials]/update-machine-form.tsx` to see how `isAdmin` is used there (lines 70, 77, 115, 245).

The update form uses `isAdmin` to:

- Show owner transfer warning (line 115)
- Show owner selection or read-only display (line 245)

Technicians should also have these abilities. Change `isAdmin` to `canEditAnyMachine` in the page and form:

In `src/app/(app)/m/[initials]/page.tsx:152`:

```typescript
const isAdmin = accessLevel === "admin";
```

to:

```typescript
const canEditAnyMachine =
  accessLevel === "admin" || accessLevel === "technician";
```

Pass this to the form and update the form's prop name accordingly.

**Step 7: Update deleteCommentAction**

In `src/app/(app)/issues/actions.ts:809`, change:

```typescript
if (existingComment.authorId !== user.id && userProfile?.role !== "admin") {
```

This stays the same — only admins can delete others' comments. Technicians do NOT get this ability.

**Step 8: Update report actions**

In `src/app/report/actions.ts:156`, change:

```typescript
if (profile?.role === "admin" || profile?.role === "member") {
```

to:

```typescript
if (profile?.role === "admin" || profile?.role === "technician" || profile?.role === "member") {
```

**Step 9: Update report form**

In `src/app/report/unified-report-form.tsx:205`, change:

```typescript
const isAdminOrMember = accessLevel === "admin" || accessLevel === "member";
```

to:

```typescript
const isAdminOrMember =
  accessLevel === "admin" ||
  accessLevel === "technician" ||
  accessLevel === "member";
```

**Step 10: Update issues page**

In `src/app/(app)/issues/page.tsx:59`, check `isAdmin` usage. It's passed to `buildWhereConditions` for email search (admin-only feature for privacy). Technicians should NOT get email search — this stays admin-only. No change needed.

**Step 11: Commit**

```bash
git add src/app/
git commit -m "feat(actions): update server actions and pages for technician role"
```

---

### Task 7: Zod Schemas — Add `"technician"` to Validation

**Files:**

- Modify: `src/app/(app)/admin/users/schema.ts`

**Step 1: Update updateUserRoleSchema**

In `src/app/(app)/admin/users/schema.ts:5`, change:

```typescript
newRole: z.enum(["guest", "member", "admin"]),
```

to:

```typescript
newRole: z.enum(["guest", "member", "technician", "admin"]),
```

**Step 2: Update inviteUserSchema**

In line 24, change:

```typescript
role: z.enum(["guest", "member"]), // Explicitly exclude "admin"
```

to:

```typescript
role: z.enum(["guest", "member", "technician"]), // Explicitly exclude "admin"
```

**Step 3: Commit**

```bash
git add src/app/(app)/admin/users/schema.ts
git commit -m "feat(validation): add technician to Zod role schemas"
```

---

### Task 8: UI Components — Admin Panel + Sidebar + Forbidden

**Files:**

- Modify: `src/app/(app)/admin/users/user-role-select.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/(app)/admin/users/actions.ts`

**Step 1: Update UserRoleSelect**

In `src/app/(app)/admin/users/user-role-select.tsx:17`, change:

```typescript
currentRole: "guest" | "member" | "admin";
```

to:

```typescript
currentRole: "guest" | "member" | "technician" | "admin";
```

In line 31:

```typescript
const handleRoleChange = (newRole: "guest" | "member" | "admin"): void => {
```

to:

```typescript
const handleRoleChange = (newRole: "guest" | "member" | "technician" | "admin"): void => {
```

In line 69, add the Technician option between Member and Admin:

```tsx
<SelectItem value="guest">Guest</SelectItem>
<SelectItem value="member">Member</SelectItem>
<SelectItem value="technician">Technician</SelectItem>
<SelectItem value="admin">Admin</SelectItem>
```

**Step 2: Update updateUserRole action**

In `src/app/(app)/admin/users/actions.ts:31`, change:

```typescript
newRole: "guest" | "member" | "admin",
```

to:

```typescript
newRole: "guest" | "member" | "technician" | "admin",
```

**Step 3: Update admin role description in admin panel**

In `src/app/(app)/admin/users/actions.ts:447` (the `admin.users.roles` description in the matrix), update from:

```
"Change user roles (guest, member, admin)"
```

to:

```
"Change user roles (guest, member, technician, admin)"
```

Wait — that description is in the matrix file, not the actions file. This was already handled in Task 2. Skip this step.

**Step 4: Sidebar admin link**

In `src/components/layout/Sidebar.tsx:227`, the admin link is gated on `role === "admin"`. This stays admin-only — no change needed for technician.

**Step 5: Commit**

```bash
git add src/app/(app)/admin/users/ src/components/layout/Sidebar.tsx
git commit -m "feat(ui): add technician option to role select and update types"
```

---

### Task 9: RLS Context — Update UserRole Import

**Files:**

- Modify: `src/server/db/utils/rls.ts` (only if needed)

**Step 1: Verify rls.ts**

The `rls.ts` file imports `UserRole` from `~/lib/types`. Since we updated `UserRole` in Task 1, this should work automatically. The RLS context passes the role string to PostgreSQL — `"technician"` will be passed correctly.

No code change needed. Just verify with type check.

**Step 2: Verify Forbidden component**

`src/components/errors/Forbidden.tsx` uses `.charAt(0).toUpperCase() + role.slice(1)` for the display label. "technician" → "Technician" — this works automatically. No change needed.

---

### Task 10: Unit Tests — Update Permission Matrix Tests

**Files:**

- Modify: `src/test/unit/permissions-matrix.test.ts`

**Step 1: Update ACCESS_LEVELS test**

In `src/test/unit/permissions-matrix.test.ts:22-27`, change:

```typescript
expect(ACCESS_LEVELS).toEqual(["unauthenticated", "guest", "member", "admin"]);
```

to:

```typescript
expect(ACCESS_LEVELS).toEqual([
  "unauthenticated",
  "guest",
  "member",
  "technician",
  "admin",
]);
```

**Step 2: Add technician-specific permission tests**

Add a new describe block after "Specific permission rules from design":

```typescript
describe("Technician role permissions", () => {
  it("should allow technician to create machines", () => {
    expect(getPermission("machines.create", "technician")).toBe(true);
  });

  it("should allow technician to edit any machine", () => {
    expect(getPermission("machines.edit", "technician")).toBe(true);
  });

  it("should restrict technician from admin panel", () => {
    expect(getPermission("admin.access", "technician")).toBe(false);
    expect(getPermission("admin.users.invite", "technician")).toBe(false);
    expect(getPermission("admin.users.roles", "technician")).toBe(false);
  });

  it("should restrict technician from deleting others comments", () => {
    expect(getPermission("comments.delete.any", "technician")).toBe(false);
  });

  it("should restrict technician ownerNotes to owner-only", () => {
    expect(getPermission("machines.edit.ownerNotes", "technician")).toBe(
      "owner"
    );
    expect(getPermission("machines.view.ownerNotes", "technician")).toBe(
      "owner"
    );
  });

  it("should allow technician all issue permissions like member", () => {
    expect(getPermission("issues.update.severity", "technician")).toBe(true);
    expect(getPermission("issues.update.status", "technician")).toBe(true);
    expect(getPermission("issues.update.priority", "technician")).toBe(true);
    expect(getPermission("issues.update.assignee", "technician")).toBe(true);
  });
});
```

**Step 3: Update comment permission tests**

Replace `"comments.edit.own"` with `"comments.edit"` and `"comments.delete.own"` with `"comments.delete"` throughout the test file. The renamed tests in the "Comments" describe block (lines 288-308) become:

```typescript
it("should use ownership checks for editing comments", () => {
  expect(getPermission("comments.edit", "unauthenticated")).toBe(false);
  expect(getPermission("comments.edit", "guest")).toBe("own");
  expect(getPermission("comments.edit", "member")).toBe(true);
  expect(getPermission("comments.edit", "technician")).toBe(true);
  expect(getPermission("comments.edit", "admin")).toBe(true);
});

it("should use ownership checks for deleting comments", () => {
  expect(getPermission("comments.delete", "unauthenticated")).toBe(false);
  expect(getPermission("comments.delete", "guest")).toBe("own");
  expect(getPermission("comments.delete", "member")).toBe(true);
  expect(getPermission("comments.delete", "technician")).toBe(true);
  expect(getPermission("comments.delete", "admin")).toBe(true);
});
```

**Step 4: Update hierarchy tests**

The "Permission hierarchy" describe block needs to include technician. Update the test at line 180:

```typescript
it("should grant admin all permissions that technician has (except owner-only)", () => {
  for (const category of PERMISSIONS_MATRIX) {
    for (const permission of category.permissions) {
      if (ownerOnlyPermissions.has(permission.id)) continue;

      const techValue = permission.access.technician;
      const adminValue = permission.access.admin;

      if (techValue === true) {
        expect(adminValue).toBe(true);
      }
      if (techValue === "own" || techValue === "owner") {
        expect(
          adminValue === true || adminValue === "own" || adminValue === "owner"
        ).toBe(true);
      }
    }
  }
});

it("should grant technician all permissions that member has", () => {
  for (const category of PERMISSIONS_MATRIX) {
    for (const permission of category.permissions) {
      const memberValue = permission.access.member;
      const techValue = permission.access.technician;

      if (memberValue === true) {
        expect(techValue === true).toBe(true);
      }
      if (memberValue === "own" || memberValue === "owner") {
        expect(
          techValue === true || techValue === "own" || techValue === "owner"
        ).toBe(true);
      }
    }
  }
});
```

Update the existing admin-member test to also check admin > technician transitivity.

**Step 5: Update machines test**

The test "should only allow admin to create machines" at line 312 needs to include technician:

```typescript
it("should allow admin and technician to create machines", () => {
  expect(getPermission("machines.create", "guest")).toBe(false);
  expect(getPermission("machines.create", "member")).toBe(false);
  expect(getPermission("machines.create", "technician")).toBe(true);
  expect(getPermission("machines.create", "admin")).toBe(true);
});
```

**Step 6: Run tests**

Run: `pnpm vitest run src/test/unit/permissions-matrix.test.ts`

Expected: All pass.

**Step 7: Commit**

```bash
git add src/test/unit/permissions-matrix.test.ts
git commit -m "test(permissions): update matrix tests for technician role"
```

---

### Task 11: Unit Tests — Update Permission Helpers Tests

**Files:**

- Modify: `src/test/unit/permissions-helpers.test.ts`

**Step 1: Update getAccessLevel test**

Add at line 29:

```typescript
expect(getAccessLevel("technician")).toBe("technician");
```

**Step 2: Rename comment permission references**

Replace all `"comments.edit.own"` with `"comments.edit"` and `"comments.delete.own"` with `"comments.delete"` in the test file.

**Step 3: Add technician-specific tests**

Add after the existing ownership tests:

```typescript
describe("Technician permissions", () => {
  const userId = "user-123";

  it("should allow technician to create machines", () => {
    expect(checkPermission("machines.create", "technician")).toBe(true);
  });

  it("should allow technician to edit any machine without ownership", () => {
    expect(checkPermission("machines.edit", "technician")).toBe(true);
  });

  it("should restrict technician ownerNotes to owner-only", () => {
    const ownerContext: OwnershipContext = {
      userId,
      machineOwnerId: userId,
    };
    const nonOwnerContext: OwnershipContext = {
      userId,
      machineOwnerId: "other-user",
    };
    expect(
      checkPermission("machines.edit.ownerNotes", "technician", ownerContext)
    ).toBe(true);
    expect(
      checkPermission("machines.edit.ownerNotes", "technician", nonOwnerContext)
    ).toBe(false);
  });

  it("should deny technician admin access", () => {
    expect(checkPermission("admin.access", "technician")).toBe(false);
  });
});
```

**Step 4: Update denied reason tests**

Update the test at line 175-178. The member denial message now says "Technicians or admins":

```typescript
it("should return technicians/admin message for member role denial on machine create", () => {
  const reason = getPermissionDeniedReason("machines.create", "member");
  expect(reason).toContain("Technicians");
});

it("should return admin message for technician role denial", () => {
  const reason = getPermissionDeniedReason("admin.access", "technician");
  expect(reason).toContain("admin");
});
```

**Step 5: Run tests**

Run: `pnpm vitest run src/test/unit/permissions-helpers.test.ts`

Expected: All pass.

**Step 6: Commit**

```bash
git add src/test/unit/permissions-helpers.test.ts
git commit -m "test(permissions): update helper tests for technician role"
```

---

### Task 12: Legacy Permission Tests

**Files:**

- Modify: `src/lib/permissions.test.ts`

**Step 1: Add technician test cases**

Add tests for technician in `canUpdateIssue` and `canEditIssueTitle`:

```typescript
it("should allow technician to update any issue", () => {
  const user = { id: "tech-1", role: "technician" as const };
  const issue = { reportedBy: "other-user", assignedTo: null };
  const machine = { ownerId: "other-user" };
  expect(canUpdateIssue(user, issue, machine)).toBe(true);
});

it("should allow technician to edit any issue title", () => {
  const user = { id: "tech-1", role: "technician" as const };
  const issue = { reportedBy: "other-user", assignedTo: null };
  expect(canEditIssueTitle(user, issue)).toBe(true);
});
```

**Step 2: Run tests**

Run: `pnpm vitest run src/lib/permissions.test.ts`

Expected: All pass.

**Step 3: Commit**

```bash
git add src/lib/permissions.test.ts
git commit -m "test(permissions): add technician cases to legacy permission tests"
```

---

### Task 13: Seed SQL — Update Trigger Comment

**Files:**

- Modify: `supabase/seed.sql`

**Step 1: Update trigger comment**

The `handle_new_user()` function at `supabase/seed.sql:16` already uses `COALESCE(v_role, 'guest')` which will naturally pass through `"technician"` from `invited_users.role`. No code change needed.

Update the COMMENT ON FUNCTION at line 122 to mention the technician role:

```sql
COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a user_profile and notification_preferences when a new user signs up via Supabase Auth. Works for both email/password and OAuth (Google, GitHub). Also transfers guest issues (by reporter_email) and handles legacy invited_users cleanup by transferring their machines/issues and removing the invited_users record. Non-invited signups default to guest role. Invited users inherit their role (guest, member, technician, or admin).';
```

**Step 2: Commit**

```bash
git add supabase/seed.sql
git commit -m "docs(seed): update trigger comment for technician role"
```

---

### Task 14: Final Verification

**Step 1: Run full check**

Run: `pnpm run check`

This runs types, lint, format, unit tests, yamllint, actionlint, ruff, and shellcheck.

Expected: All pass. Fix any issues.

**Step 2: Run preflight**

Run: `pnpm run preflight`

This adds build + integration tests on top of check.

Expected: All pass.

**Step 3: Search for any remaining hardcoded role lists**

Run: `rg '"guest".*"member".*"admin"' src/ --type ts -l` to find any remaining files with the old 3-role list that need updating.

Also run: `rg 'comments\.(edit|delete)\.own' src/ --type ts` to confirm no references to old comment permission IDs remain.

**Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: address remaining technician role issues from verification"
```

---

### Task 15: Push and Cleanup

**Step 1: Push**

```bash
git push -u origin HEAD
```

**Step 2: Verify remote**

```bash
git status
```

Expected: "Your branch is up to date with origin."
