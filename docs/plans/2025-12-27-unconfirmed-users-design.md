# Unconfirmed Users & Invitation System Design

**Date**: December 27, 2025
**Status**: Approved
**Scope**: MVP+

## Overview

This design enables PinPoint to track machine owners and issue reporters who don't have accounts yet. Admins can add unconfirmed users (with optional email invitations), and the system automatically links them when they sign up. This supports two key MVP+ features: machine ownership tracking and email capture for public issue reporting.

## Goals

1. Allow admins to assign machine owners before they create accounts
2. Capture optional email for public issue reporters (MVP+ feature)
3. Automatically link unconfirmed users to their content when they sign up
4. Enable admins to send invitation emails to unconfirmed users
5. Provide unified admin interface for managing all users (activated + unconfirmed)

## User Flows

### Flow 1: Admin Adds Machine Owner (with invite)

1. Admin navigates to machine create/edit form or Admin Users page
2. Clicks "Invite User" or "+ Add New Owner"
3. Dialog opens with fields: First Name, Last Name, Email, Role, "Send invitation email" checkbox
4. Admin fills form and checks "Send invitation email"
5. System creates `unconfirmed_users` record and sends invite email via Resend
6. New unconfirmed owner appears in dropdown with "Unconfirmed" badge
7. Machine is assigned to unconfirmed owner

### Flow 2: Public Reporter Provides Email (passive)

1. Anonymous user visits `/report` to report an issue
2. Form includes optional "Your email (for updates)" field
3. User provides email and submits issue
4. System creates/finds `unconfirmed_users` record (no invite sent)
5. Issue's `unconfirmedReportedBy` is set to that user
6. Default role: `guest`

### Flow 3: Unconfirmed User Signs Up (auto-linking)

1. User signs up with email matching an `unconfirmed_users.email`
2. Supabase Auth creates account, database trigger creates `user_profiles` entry
3. Auto-linking trigger detects match:
   - Updates machines: `SET owner_id = new_user_id, unconfirmed_owner_id = NULL`
   - Updates issues: `SET reported_by = new_user_id, unconfirmed_reported_by = NULL`
   - Deletes `unconfirmed_users` row (cleanup)
4. User now owns their machines and issues

### Flow 4: Admin Resends Invitation

1. Admin navigates to Admin Users page
2. Finds unconfirmed user in table
3. Clicks "Resend Invite" button
4. System sends invitation email, updates `invite_sent_at` timestamp
5. Toast notification: "Invitation sent to email@example.com"

## Data Model

### New Table: unconfirmed_users

```typescript
export const unconfirmedUsers = pgTable("unconfirmed_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  name: text("name")
    .generatedAlwaysAs(sql`first_name || ' ' || last_name`)
    .notNull(),
  email: text("email").notNull().unique(), // For auto-linking on signup
  role: text("role", { enum: ["guest", "member", "admin"] })
    .notNull()
    .default("guest"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  inviteSentAt: timestamp("invite_sent_at"), // Null for public reporters
});
```

### Updated Table: machines

```typescript
export const machines = pgTable(
  "machines",
  {
    // ... existing fields
    ownerId: uuid("owner_id").references(() => userProfiles.id),
    unconfirmedOwnerId: uuid("unconfirmed_owner_id").references(
      () => unconfirmedUsers.id
    ),
  },
  (t) => ({
    // ... existing constraints
    ownerCheck: check(
      "owner_check",
      sql`(owner_id IS NULL OR unconfirmed_owner_id IS NULL)`
    ),
  })
);
```

**Constraint Logic**: A machine can have:

- Activated owner only (`owner_id` set, `unconfirmed_owner_id` NULL)
- Unconfirmed owner only (`unconfirmed_owner_id` set, `owner_id` NULL)
- No owner (both NULL)
- **Cannot** have both activated AND unconfirmed owner

### Updated Table: issues

```typescript
export const issues = pgTable(
  "issues",
  {
    // ... existing fields
    reportedBy: uuid("reported_by").references(() => userProfiles.id),
    unconfirmedReportedBy: uuid("unconfirmed_reported_by").references(
      () => unconfirmedUsers.id
    ),
  },
  (t) => ({
    // ... existing constraints
    reporterCheck: check(
      "reporter_check",
      sql`(reported_by IS NULL OR unconfirmed_reported_by IS NULL)`
    ),
  })
);
```

**Constraint Logic**: Same pattern as machines - can have activated reporter, unconfirmed reporter, or neither, but not both.

## Auto-Linking Implementation

### Database Trigger: link_unconfirmed_user()

Executes AFTER INSERT on `user_profiles` table:

```sql
CREATE OR REPLACE FUNCTION link_unconfirmed_user()
RETURNS TRIGGER AS $$
DECLARE
  unconfirmed_user_id uuid;
  user_email text;
BEGIN
  -- Get email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Find matching unconfirmed user
  SELECT id INTO unconfirmed_user_id
  FROM unconfirmed_users
  WHERE email = user_email;

  IF unconfirmed_user_id IS NOT NULL THEN
    -- Link machines
    UPDATE machines
    SET owner_id = NEW.id, unconfirmed_owner_id = NULL
    WHERE unconfirmed_owner_id = unconfirmed_user_id;

    -- Link issues
    UPDATE issues
    SET reported_by = NEW.id, unconfirmed_reported_by = NULL
    WHERE unconfirmed_reported_by = unconfirmed_user_id;

    -- Transfer role from unconfirmed user to profile
    UPDATE user_profiles
    SET role = (SELECT role FROM unconfirmed_users WHERE id = unconfirmed_user_id)
    WHERE id = NEW.id;

    -- Cleanup: delete unconfirmed user record
    DELETE FROM unconfirmed_users WHERE id = unconfirmed_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER link_unconfirmed_user_trigger
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_unconfirmed_user();
```

**Why Database Trigger?**

- Automatic: Works for email/password AND OAuth signups (Google, GitHub)
- Atomic: All changes in one transaction
- Centralized: Single source of logic
- Reliable: No application code needed

## UI Components

### 1. InviteUserDialog Component

**File**: `src/components/users/InviteUserDialog.tsx`

**Purpose**: Reusable dialog for inviting unconfirmed users

**Used in**:

- Admin Users page ("Invite User" button)
- Machine owner selection ("+ Add New Owner" option)

**Props**:

```typescript
interface InviteUserDialogProps {
  trigger: React.ReactNode; // Button or link to open dialog
  onSuccess?: (userId: string) => void; // Callback after user created
}
```

**Form Fields**:

- First Name (text, required)
- Last Name (text, required)
- Email (email, required, validated)
- Role (select: guest/member/admin, required, default: member)
- Send invitation email (checkbox, default: unchecked)

**Server Action**: `inviteUserAction(formData: FormData)`

- Validates inputs with Zod
- Creates `unconfirmed_users` record
- If checkbox checked: sends email via Resend
- Returns success state with new user ID

**Admin Permission**: Dialog only shown to users with `role = "admin"`

### 2. OwnerSelect Component (Updated)

**File**: `src/components/machines/OwnerSelect.tsx`

**Current State**: Simple dropdown of activated users

**Updated State**:

- Dropdown shows activated users (green checkmark ✓) + unconfirmed users (orange badge "Unconfirmed")
- "+ Add New Owner" option at bottom of dropdown
- Opens `InviteUserDialog` when clicked
- Auto-selects newly created owner

**Props**:

```typescript
interface OwnerSelectProps {
  users: { id: string; name: string }[]; // Activated users
  unconfirmedUsers: { id: string; name: string }[]; // Unconfirmed users
  defaultValue?: string | null; // Activated owner ID
  defaultUnconfirmedValue?: string | null; // Unconfirmed owner ID
  isAdmin: boolean; // Show "Add New Owner" only to admins
}
```

**Dropdown Rendering**:

```
John Smith ✓               (activated - green checkmark)
Jane Doe (Unconfirmed)     (unconfirmed - orange badge)
Bob Johnson ✓              (activated - green checkmark)
────────────────────
+ Add New Owner            (admin only)
```

### 3. Admin Users Page (Updated)

**File**: `src/app/(app)/admin/users/page.tsx`

**Current State**: Table showing only activated users with role management

**Updated State**:

- Table shows BOTH activated and unconfirmed users
- Unified view with status badges
- "Invite User" button in header

**Table Columns**:

- User (name + avatar, fallback for unconfirmed)
- Email
- Status ("Active" ✓ or "Unconfirmed" ⏳)
- Role (dropdown for both types)
- Actions ("Resend Invite" for unconfirmed users only)

**Query**:

```typescript
// Fetch activated users
const activatedUsers = await db
  .select({
    id: userProfiles.id,
    name: userProfiles.name,
    email: authUsers.email,
    role: userProfiles.role,
    avatarUrl: userProfiles.avatarUrl,
    status: sql<"active">`'active'`,
  })
  .from(userProfiles)
  .leftJoin(authUsers, eq(userProfiles.id, authUsers.id));

// Fetch unconfirmed users
const unconfirmedUsers = await db
  .select({
    id: unconfirmedUsers.id,
    name: unconfirmedUsers.name,
    email: unconfirmedUsers.email,
    role: unconfirmedUsers.role,
    avatarUrl: sql<null>`null`,
    status: sql<"unconfirmed">`'unconfirmed'`,
    inviteSentAt: unconfirmedUsers.inviteSentAt,
  })
  .from(unconfirmedUsers);

// Merge and sort
const allUsers = [...activatedUsers, ...unconfirmedUsers].sort((a, b) =>
  a.name.localeCompare(b.name)
);
```

**Visual Design**:

```
┌─────────────────────────────────────────────────────────────┐
│ User Management                          [Invite User]      │
├─────────────────────────────────────────────────────────────┤
│ User             Email              Status        Role       │
│ John Smith       john@ex.com        Active ✓      [Member▼] │
│ Jane Doe         jane@ex.com        Unconfirmed ⏳ [Member▼] │
│                                      Resend Invite           │
│ Bob Admin        bob@ex.com         Active ✓      [Admin ▼] │
└─────────────────────────────────────────────────────────────┘
```

### 4. Public Issue Form (Updated)

**File**: `src/app/report/page.tsx`

**New Field**: Email (optional)

```tsx
<div className="space-y-2">
  <Label htmlFor="email" className="text-on-surface">
    Your Email (optional)
  </Label>
  <Input
    id="email"
    name="email"
    type="email"
    placeholder="your.email@example.com"
    className="border-outline-variant bg-surface text-on-surface"
  />
  <p className="text-xs text-on-surface-variant">
    Provide your email to receive updates about this issue
  </p>
</div>
```

**Server Action Update**: `submitPublicIssueAction()`

- Validate email if provided (Zod)
- If email provided:
  - Find or create `unconfirmed_users` record (firstName: "Anonymous", lastName: "Reporter", role: guest)
  - Set `issue.unconfirmedReportedBy` to that user ID
- If email NOT provided:
  - Leave `issue.reportedBy` and `issue.unconfirmedReportedBy` as NULL (anonymous)

## Invitation Email

**Provider**: Resend (already configured in project)

**From**: PinPoint <noreply@pinpoint.app> (or configured domain)

**Subject**: "You've been invited to PinPoint"

**Body** (HTML + plain text):

```html
<h2>You've been invited to PinPoint!</h2>

<p>Hi {firstName},</p>

<p>
  {inviterName} has added you as an owner of pinball machines in PinPoint, the
  issue tracking system for Austin Pinball Collective.
</p>

<p><strong>Create your account to get started:</strong></p>
<a href="{siteUrl}/signup?email={email}">Create Account</a>

<p>Once you sign up, you'll be able to:</p>
<ul>
  <li>View and manage issues for your machines</li>
  <li>Receive notifications about new issues</li>
  <li>Track repair history</li>
</ul>

<p>Questions? Reply to this email.</p>

<p>— The PinPoint Team</p>
```

**Plain Text Version**: Same content without HTML formatting

**Implementation File**: `src/lib/email/invite.ts`

```typescript
export async function sendInviteEmail({
  to: string,
  firstName: string,
  inviterName: string,
}): Promise<void> {
  await resend.emails.send({
    from: "PinPoint <noreply@pinpoint.app>",
    to,
    subject: "You've been invited to PinPoint",
    html: renderInviteEmailHtml({ firstName, inviterName }),
    text: renderInviteEmailText({ firstName, inviterName }),
  });
}
```

## Server Actions

### 1. inviteUserAction

**File**: `src/app/(app)/admin/users/actions.ts`

**Purpose**: Create unconfirmed user and optionally send invite

**Input Validation** (Zod):

```typescript
const inviteUserSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  role: z.enum(["guest", "member", "admin"]),
  sendInvite: z.boolean().optional(),
});
```

**Flow**:

1. Verify current user is admin (permissions check)
2. Validate form data
3. Check if email already exists (unconfirmed_users OR auth.users)
4. Create unconfirmed_users record
5. If sendInvite checked: call `sendInviteEmail()`
6. Return success state

**Return Type**:

```typescript
type InviteUserResult =
  | { ok: true; userId: string; message: string }
  | { ok: false; message: string };
```

### 2. resendInviteAction

**File**: `src/app/(app)/admin/users/actions.ts`

**Purpose**: Resend invitation to existing unconfirmed user

**Input**: `userId: string` (unconfirmed user ID)

**Flow**:

1. Verify current user is admin
2. Fetch unconfirmed user by ID
3. Send invitation email
4. Update `invite_sent_at` timestamp
5. Return success state

**Optional Rate Limiting**: Check if `invite_sent_at` is within last 24 hours, show error if too recent

### 3. updateUserRoleAction (Updated)

**File**: `src/app/(app)/admin/users/actions.ts`

**Current**: Updates role for activated users only

**Updated**: Support both activated and unconfirmed users

**Input**:

```typescript
{
  userId: string;
  role: "guest" | "member" | "admin";
  userType: "activated" | "unconfirmed";
}
```

**Flow**:

- If userType = "activated": Update `user_profiles.role`
- If userType = "unconfirmed": Update `unconfirmed_users.role`

## Query Helpers

### getUnifiedUsers()

**File**: `src/lib/users/queries.ts`

**Purpose**: Get combined list of activated + unconfirmed users for dropdowns/tables

**Return Type**:

```typescript
type UnifiedUser = {
  id: string;
  name: string;
  email: string;
  role: "guest" | "member" | "admin";
  status: "active" | "unconfirmed";
  avatarUrl: string | null;
  inviteSentAt?: Date | null; // Only for unconfirmed
};
```

**Usage**: Admin Users page, owner selection dropdowns, anywhere unified user list needed

### getMachineOwner()

**File**: `src/lib/machines/queries.ts`

**Purpose**: Get owner for a machine (activated or unconfirmed)

**Return Type**:

```typescript
type MachineOwner = {
  id: string;
  name: string;
  email: string;
  status: "active" | "unconfirmed";
} | null;
```

**Query Logic**:

- If `machine.ownerId` is set: return from user_profiles
- Else if `machine.unconfirmedOwnerId` is set: return from unconfirmed_users
- Else: return null

## Testing Strategy

### Unit Tests

**File**: `src/lib/users/queries.test.ts`

- Test `getUnifiedUsers()` returns merged list
- Test sorting by name
- Test filtering by status

**File**: `src/lib/machines/queries.test.ts`

- Test `getMachineOwner()` for activated owner
- Test `getMachineOwner()` for unconfirmed owner
- Test `getMachineOwner()` when no owner

**File**: `src/app/(app)/admin/users/actions.test.ts`

- Test `inviteUserAction()` creates unconfirmed user
- Test email validation
- Test duplicate email detection
- Test admin permission check

### Integration Tests (with PGlite)

**File**: `src/test/integration/unconfirmed-users.test.ts`

- Test creating unconfirmed user
- Test auto-linking on user signup
- Test machines transfer from unconfirmed to activated owner
- Test issues transfer from unconfirmed to activated reporter
- Test role transfer from unconfirmed user to profile
- Test cleanup of unconfirmed_users record after linking

### E2E Tests (Playwright)

**File**: `e2e/smoke/admin-users.spec.ts`

- Admin can invite user via Admin Users page
- Unconfirmed users appear in table with "Unconfirmed" badge
- Admin can change role for unconfirmed users
- Admin can resend invitation

**File**: `e2e/smoke/machine-ownership.spec.ts`

- Admin can add machine with unconfirmed owner
- Unconfirmed owner appears in owner dropdown
- Machine detail shows owner name with "Unconfirmed" indicator

**File**: `e2e/smoke/public-reporting.spec.ts`

- Public form has optional email field
- Submitting with email creates unconfirmed user
- Issue is linked to unconfirmed reporter

## Technical Decisions

**Why separate unconfirmed_users table instead of unified users table?**

- Maintains standard Supabase pattern (`user_profiles.id = auth.users.id`)
- Simpler to understand and maintain
- Clear separation of activated vs unconfirmed state
- No risk of breaking existing auth flows

**Why database trigger for auto-linking instead of application code?**

- Works for all signup methods (email/password, OAuth)
- Atomic transaction ensures data consistency
- No application code to maintain
- Follows existing `handle_new_user()` trigger pattern

**Why delete unconfirmed_users record after linking?**

- Clean data model - no orphaned records
- Simpler queries - don't need to filter out activated users
- All user data lives in single place after activation
- Audit trail preserved via database logs if needed

**Why allow unconfirmed users to have roles?**

- Role is preserved when they activate account
- Enables pre-assigning permissions (e.g., admin invites another admin)
- Simplifies auto-linking logic
- Matches real-world intent ("I want Tim to be an admin")

**Why optional email for public reporters instead of required?**

- MVP already supports anonymous reporting
- Making it required breaks existing flow
- Optional allows gradual adoption
- Can make required later if desired

## Migration Strategy

1. **Create unconfirmed_users table** via Drizzle migration
2. **Add columns to machines/issues** (unconfirmedOwnerId, unconfirmedReportedBy)
3. **Create auto-linking trigger** in migration SQL
4. **Add CHECK constraints** to ensure owner/reporter exclusivity
5. **Update queries** to handle both user types
6. **Deploy UI changes** (admin page, dialogs, forms)

**Migration Order**:

1. Schema changes (table, columns, constraints)
2. Database trigger
3. Query helpers
4. Server actions
5. UI components
6. Tests

## Future Enhancements (Out of Scope)

- Bulk invite via CSV upload
- Customizable invitation email templates
- Track invitation acceptance rate
- Automatic reminders for unconfirmed users
- Merge duplicate unconfirmed users
- Admin can manually link unconfirmed user to existing account
- Unconfirmed users can "claim" their account via magic link

## Success Criteria

- [ ] Admins can invite users with name, email, and role
- [ ] Invitation emails send successfully via Resend
- [ ] Unconfirmed users appear in Admin Users page with "Unconfirmed" badge
- [ ] Admins can change roles for unconfirmed users
- [ ] Admins can resend invitations
- [ ] Machines can be assigned to unconfirmed owners
- [ ] Public issue form has optional email field
- [ ] Issues link to unconfirmed reporters when email provided
- [ ] Auto-linking works on user signup (email/password)
- [ ] Auto-linking works on user signup (OAuth - Google, GitHub)
- [ ] Machines transfer from unconfirmed to activated owner
- [ ] Issues transfer from unconfirmed to activated reporter
- [ ] Role transfers from unconfirmed user to profile
- [ ] Unconfirmed user record deleted after linking
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E smoke tests pass
- [ ] No console errors during invite flow
- [ ] No orphaned unconfirmed_users records after signup

## Related Documentation

- `docs/PRODUCT_SPEC.md` - Update to mark MVP+ status
- `docs/NON_NEGOTIABLES.md` - Add any new patterns/constraints
- `CHANGELOG.md` - Document this feature when shipped
