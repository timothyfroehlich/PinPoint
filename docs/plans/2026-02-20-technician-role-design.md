# Technician Role Design

## Problem

PinPoint has three roles: guest, member, admin. There's a gap between member and admin — members can manage issues but can't create/edit machines, while admins have full system access including user management. We need a "technician" role for people who maintain machines and manage issues without administrative authority.

## Role Hierarchy

```
admin > technician > member > guest
```

`USER_ROLES` becomes `["admin", "technician", "member", "guest"]`.

## Permission Matrix

### Issues

| Permission               | Guest | Member | Technician | Admin |
| :----------------------- | :---- | :----- | :--------- | :---- |
| `issues.view`            | Yes   | Yes    | Yes        | Yes   |
| `issues.report`          | Yes   | Yes    | Yes        | Yes   |
| `issues.report.status`   | No    | Yes    | Yes        | Yes   |
| `issues.report.priority` | No    | Yes    | Yes        | Yes   |
| `issues.report.assignee` | No    | Yes    | Yes        | Yes   |
| `issues.update.severity` | Own   | Yes    | Yes        | Yes   |
| `issues.update.frequency`| Own   | Yes    | Yes        | Yes   |
| `issues.update.status`   | Own   | Yes    | Yes        | Yes   |
| `issues.update.priority` | No    | Yes    | Yes        | Yes   |
| `issues.update.assignee` | No    | Yes    | Yes        | Yes   |
| `issues.watch`           | Yes   | Yes    | Yes        | Yes   |

Technician is identical to member and admin for all issue permissions.

### Comments (BREAKING CHANGE: rename)

Old `comments.edit.own` and `comments.delete.own` are renamed to `comments.edit` and `comments.delete`. The `.own` suffix was redundant — the permission name described the scope, then the value also said `"own"`. Now the value alone carries the scope.

| Permission            | Guest | Member | Technician | Admin |
| :-------------------- | :---- | :----- | :--------- | :---- |
| `comments.view`       | Yes   | Yes    | Yes        | Yes   |
| `comments.add`        | Yes   | Yes    | Yes        | Yes   |
| `comments.edit`       | Own   | Yes    | Yes        | Yes   |
| `comments.delete`     | Own   | Yes    | Yes        | Yes   |
| `comments.delete.any` | No    | No     | No         | Yes   |

Technician is identical to member — own comments only, no moderation.

### Machines

| Permission                       | Guest | Member | Technician | Admin |
| :------------------------------- | :---- | :----- | :--------- | :---- |
| `machines.view`                  | Yes   | Yes    | Yes        | Yes   |
| `machines.view.ownerRequirements`| Yes   | Yes    | Yes        | Yes   |
| `machines.view.ownerNotes`       | Owner | Owner  | Owner      | Owner |
| `machines.watch`                 | Yes   | Yes    | Yes        | Yes   |
| `machines.create`                | No    | No     | Yes        | Yes   |
| `machines.edit`                  | No    | Owner  | Yes        | Yes   |
| `machines.edit.ownerNotes`       | No    | Owner  | Owner      | Owner |

Key differentiator: technicians can create machines and edit any machine (like admin). Owner notes remain owner-exclusive for everyone.

### Images

| Permission      | Guest | Member | Technician | Admin |
| :-------------- | :---- | :----- | :--------- | :---- |
| `images.upload` | Yes   | Yes    | Yes        | Yes   |

No change.

### Admin

| Permission          | Guest | Member | Technician | Admin |
| :------------------ | :---- | :----- | :--------- | :---- |
| `admin.access`      | No    | No     | No         | Yes   |
| `admin.users.invite`| No    | No     | No         | Yes   |
| `admin.users.roles` | No    | No     | No         | Yes   |

Technicians have zero admin panel access. Role management is admin-only.

## What Changes

### Database

- `user_profiles.role` enum: add `"technician"` → requires Drizzle migration
- `invited_users.role` enum: add `"technician"` → same migration
- `supabase/seed.sql`: update `handle_new_user()` trigger to recognize new enum value

### Type System

- `src/lib/types/user.ts`: add `"technician"` to `USER_ROLES`
- `src/lib/permissions/matrix.ts`: add `technician` column to `AccessLevel` and every permission entry; rename `comments.edit.own` → `comments.edit`, `comments.delete.own` → `comments.delete`
- `src/lib/permissions/helpers.ts`: update any helpers that reference old comment permission IDs

### Permission Checks

- `src/lib/permissions/matrix.ts`: add technician access values to every permission
- `src/app/(app)/m/actions.ts`: update machine create check from `role === "admin"` to include technician
- `src/lib/permissions.ts` (legacy): update `canUpdateIssue`, `canEditIssueTitle` if they reference roles directly
- Any hardcoded `role === "admin"` checks for machine operations need to include technician

### UI

- `src/app/(app)/admin/users/user-role-select.tsx`: add "Technician" option to dropdown
- `src/components/errors/Forbidden.tsx`: add "Technician" to role display
- `src/components/help/PermissionsTable.tsx`: add technician column, update comment permission labels
- Any UI that conditionally renders based on role strings

### Tests

- `src/test/unit/permissions-matrix.test.ts`: add technician coverage
- `src/test/unit/permissions-helpers.test.ts`: update for renamed comment permissions
- `src/lib/permissions.test.ts`: add technician cases
- `src/test/integration/issue-detail-permissions.test.ts`: add technician scenarios
- E2E: technician role in machine create/edit flows

### Seed Data

- Add a technician user to seed data for development/testing

## Design Decisions

1. **Technician is identical to member for issues/comments** — the differentiator is machine management only
2. **Comment permissions renamed** — `comments.edit.own` → `comments.edit`, `comments.delete.own` → `comments.delete` to eliminate redundant `.own` suffix
3. **Owner notes stay owner-exclusive** — even technicians and admins cannot see/edit other owners' private notes
4. **Admin panel stays admin-only** — technicians cannot invite users or change roles
5. **Role ordering**: admin > technician > member > guest
