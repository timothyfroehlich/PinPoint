# Unconfirmed Users & Invitation System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable admins to invite unconfirmed users (machine owners/issue reporters) before they create accounts, with automatic linking on signup via database trigger.

**Architecture:** New `unconfirmed_users` table with auto-linking trigger on user signup. Unified admin interface showing both activated and unconfirmed users. Email invitations via Resend. Progressive enhancement for public issue email capture.

**Tech Stack:** Next.js 16 Server Components, Drizzle ORM, PostgreSQL (Supabase), TypeScript strictest, shadcn/ui, Resend, Zod validation, Vitest, Playwright

**Design Reference:** `docs/plans/2025-12-27-unconfirmed-users-design.md`

---

## Task 1: Database Schema Migration (TDD)

**Files:**

- Create: `drizzle/migrations/XXXX_add_unconfirmed_users.sql`
- Modify: `src/server/db/schema.ts`
- Modify: `drizzle.config.ts` (add table to filter if needed)

### Step 1: Update schema.ts with unconfirmed_users table

```typescript
// src/server/db/schema.ts
// Add after userProfiles export

export const unconfirmedUsers = pgTable("unconfirmed_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  name: text("name")
    .generatedAlwaysAs(sql`first_name || ' ' || last_name`)
    .notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["guest", "member", "admin"] })
    .notNull()
    .default("guest"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }),
});
```

### Step 2: Add unconfirmedOwnerId to machines table

```typescript
// src/server/db/schema.ts
// Modify machines table

export const machines = pgTable(
  "machines",
  {
    // ... existing fields
    ownerId: uuid("owner_id").references(() => userProfiles.id),
    unconfirmedOwnerId: uuid("unconfirmed_owner_id").references(
      () => unconfirmedUsers.id
    ),
    // ... rest of fields
  },
  (t) => ({
    initialsCheck: check("initials_check", sql`initials ~ '^[A-Z0-9]{2,6}$'`),
    ownerCheck: check(
      "owner_check",
      sql`(owner_id IS NULL OR unconfirmed_owner_id IS NULL)`
    ),
  })
);
```

### Step 3: Add unconfirmedReportedBy to issues table

```typescript
// src/server/db/schema.ts
// Modify issues table

export const issues = pgTable(
  "issues",
  {
    // ... existing fields
    reportedBy: uuid("reported_by").references(() => userProfiles.id),
    unconfirmedReportedBy: uuid("unconfirmed_reported_by").references(
      () => unconfirmedUsers.id
    ),
    // ... rest of fields
  },
  (t) => ({
    uniqueIssueNumber: unique("unique_issue_number").on(
      t.machineInitials,
      t.issueNumber
    ),
    reporterCheck: check(
      "reporter_check",
      sql`(reported_by IS NULL OR unconfirmed_reported_by IS NULL)`
    ),
  })
);
```

### Step 4: Add relations for unconfirmed users

```typescript
// src/server/db/schema.ts
// Add after existing relations

export const unconfirmedUsersRelations = relations(
  unconfirmedUsers,
  ({ many }) => ({
    ownedMachines: many(machines, { relationName: "unconfirmed_owner" }),
    reportedIssues: many(issues, { relationName: "unconfirmed_reporter" }),
  })
);

// Update machinesRelations to include unconfirmed owner
export const machinesRelations = relations(machines, ({ many, one }) => ({
  issues: many(issues),
  owner: one(userProfiles, {
    fields: [machines.ownerId],
    references: [userProfiles.id],
    relationName: "owner",
  }),
  unconfirmedOwner: one(unconfirmedUsers, {
    fields: [machines.unconfirmedOwnerId],
    references: [unconfirmedUsers.id],
    relationName: "unconfirmed_owner",
  }),
}));

// Update issuesRelations to include unconfirmed reporter
export const issuesRelations = relations(issues, ({ one, many }) => ({
  machine: one(machines, {
    fields: [issues.machineInitials],
    references: [machines.initials],
  }),
  reportedByUser: one(userProfiles, {
    fields: [issues.reportedBy],
    references: [userProfiles.id],
    relationName: "reported_by",
  }),
  unconfirmedReporter: one(unconfirmedUsers, {
    fields: [issues.unconfirmedReportedBy],
    references: [unconfirmedUsers.id],
    relationName: "unconfirmed_reporter",
  }),
  // ... rest of relations
}));
```

### Step 5: Generate migration

Run: `npm run db:generate -- --name add_unconfirmed_users`
Expected: Migration file created in `drizzle/migrations/`

### Step 6: Add auto-linking trigger to migration

Modify the generated SQL migration file to include:

```sql
-- Add at end of migration file

-- Function to link unconfirmed users on signup
CREATE OR REPLACE FUNCTION link_unconfirmed_user()
RETURNS TRIGGER AS $$
DECLARE
  unconfirmed_user_id uuid;
  user_email text;
  user_role text;
BEGIN
  -- Get email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Find matching unconfirmed user
  SELECT id, role INTO unconfirmed_user_id, user_role
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
    SET role = user_role
    WHERE id = NEW.id;

    -- Cleanup: delete unconfirmed user record
    DELETE FROM unconfirmed_users WHERE id = unconfirmed_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-link on user profile creation
CREATE TRIGGER link_unconfirmed_user_trigger
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_unconfirmed_user();
```

### Step 7: Update drizzle.config.ts table filter if needed

Check if `tablesFilter` exists and add `"unconfirmed_users"` to array.

### Step 8: Run migration

Run: `npm run db:migrate`
Expected: Migration applied successfully

### Step 9: Regenerate test schema

Run: `npm run test:_generate-schema`
Expected: `src/test/setup/schema.sql` updated with new tables

### Step 10: Commit schema changes

```bash
git add src/server/db/schema.ts drizzle/ src/test/setup/schema.sql drizzle.config.ts
git commit -m "feat(db): add unconfirmed_users table with auto-linking trigger

- Add unconfirmed_users table for pre-signup user tracking
- Add unconfirmedOwnerId to machines table
- Add unconfirmedReportedBy to issues table
- Add CHECK constraints to prevent dual ownership/reporting
- Add database trigger for auto-linking on signup
- Update test schema

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Type Definitions (TDD)

**Files:**

- Create: `src/lib/types/user.ts`
- Modify: `src/lib/types/index.ts`

### Step 1: Write test for UnifiedUser type

```typescript
// src/lib/types/user.test.ts
import { describe, it, expect } from "vitest";
import type { UnifiedUser } from "./user";

describe("UnifiedUser type", () => {
  it("accepts activated user", () => {
    const user: UnifiedUser = {
      id: "123",
      name: "John Doe",
      email: "john@example.com",
      role: "member",
      status: "active",
      avatarUrl: "https://example.com/avatar.jpg",
    };
    expect(user.status).toBe("active");
  });

  it("accepts unconfirmed user with inviteSentAt", () => {
    const user: UnifiedUser = {
      id: "456",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "guest",
      status: "unconfirmed",
      avatarUrl: null,
      inviteSentAt: new Date(),
    };
    expect(user.status).toBe("unconfirmed");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/lib/types/user.test.ts`
Expected: FAIL - Module not found

### Step 3: Create user types

```typescript
// src/lib/types/user.ts
import type { z } from "zod";

export type UserRole = "guest" | "member" | "admin";
export type UserStatus = "active" | "unconfirmed";

export interface UnifiedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  inviteSentAt?: Date | null; // Only for unconfirmed users
}

export interface MachineOwner {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
}
```

### Step 4: Re-export from index

```typescript
// src/lib/types/index.ts
export type { UnifiedUser, UserRole, UserStatus, MachineOwner } from "./user";
```

### Step 5: Run test to verify it passes

Run: `npm test -- src/lib/types/user.test.ts`
Expected: PASS

### Step 6: Commit type definitions

```bash
git add src/lib/types/user.ts src/lib/types/user.test.ts src/lib/types/index.ts
git commit -m "feat(types): add unconfirmed user types

- Add UnifiedUser, UserRole, UserStatus, MachineOwner types
- Add tests for type definitions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Query Helper - getUnifiedUsers (TDD)

**Files:**

- Create: `src/lib/users/queries.ts`
- Create: `src/lib/users/queries.test.ts`

### Step 1: Write failing test for getUnifiedUsers

```typescript
// src/lib/users/queries.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getUnifiedUsers } from "./queries";
import { db } from "~/server/db";
import { userProfiles, authUsers, unconfirmedUsers } from "~/server/db/schema";

describe("getUnifiedUsers", () => {
  beforeEach(async () => {
    // Clean slate
    await db.delete(userProfiles);
    await db.delete(unconfirmedUsers);
  });

  it("returns empty array when no users exist", async () => {
    const users = await getUnifiedUsers();
    expect(users).toEqual([]);
  });

  it("returns activated users only", async () => {
    // Insert auth user first
    const [authUser] = await db
      .insert(authUsers)
      .values({
        id: "auth-1",
        email: "john@example.com",
      })
      .returning();

    // Insert profile
    await db.insert(userProfiles).values({
      id: authUser.id,
      firstName: "John",
      lastName: "Doe",
      role: "member",
      avatarUrl: "https://example.com/avatar.jpg",
    });

    const users = await getUnifiedUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      id: authUser.id,
      name: "John Doe",
      email: "john@example.com",
      role: "member",
      status: "active",
      avatarUrl: "https://example.com/avatar.jpg",
    });
  });

  it("returns unconfirmed users only", async () => {
    const [unconfirmed] = await db
      .insert(unconfirmedUsers)
      .values({
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        role: "guest",
      })
      .returning();

    const users = await getUnifiedUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      id: unconfirmed.id,
      name: "Jane Smith",
      email: "jane@example.com",
      role: "guest",
      status: "unconfirmed",
      avatarUrl: null,
    });
  });

  it("returns both activated and unconfirmed users sorted by name", async () => {
    // Insert auth user
    const [authUser] = await db
      .insert(authUsers)
      .values({
        id: "auth-1",
        email: "zach@example.com",
      })
      .returning();

    await db.insert(userProfiles).values({
      id: authUser.id,
      firstName: "Zach",
      lastName: "Wilson",
      role: "member",
    });

    // Insert unconfirmed
    await db.insert(unconfirmedUsers).values({
      firstName: "Alice",
      lastName: "Anderson",
      email: "alice@example.com",
      role: "guest",
    });

    const users = await getUnifiedUsers();
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe("Alice Anderson");
    expect(users[1].name).toBe("Zach Wilson");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/lib/users/queries.test.ts`
Expected: FAIL - Module not found

### Step 3: Implement getUnifiedUsers

```typescript
// src/lib/users/queries.ts
import { db } from "~/server/db";
import { userProfiles, authUsers, unconfirmedUsers } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import type { UnifiedUser } from "~/lib/types";

export async function getUnifiedUsers(): Promise<UnifiedUser[]> {
  // Fetch activated users
  const activatedUsers = await db
    .select({
      id: userProfiles.id,
      name: userProfiles.name,
      email: authUsers.email,
      role: userProfiles.role,
      avatarUrl: userProfiles.avatarUrl,
      status: sql<"active">`'active'`,
      inviteSentAt: sql<null>`null`,
    })
    .from(userProfiles)
    .leftJoin(authUsers, eq(userProfiles.id, authUsers.id));

  // Fetch unconfirmed users
  const unconfirmedUsersList = await db
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

  // Merge and sort by name
  const allUsers = [...activatedUsers, ...unconfirmedUsersList].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return allUsers as UnifiedUser[];
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- src/lib/users/queries.test.ts`
Expected: PASS

### Step 5: Commit query helper

```bash
git add src/lib/users/queries.ts src/lib/users/queries.test.ts
git commit -m "feat(users): add getUnifiedUsers query helper

- Fetches both activated and unconfirmed users
- Sorts by name
- Returns UnifiedUser type
- Add comprehensive tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Query Helper - getMachineOwner (TDD)

**Files:**

- Modify: `src/lib/machines/queries.ts`
- Create: `src/lib/machines/queries.test.ts` (if doesn't exist)

### Step 1: Write failing test for getMachineOwner

```typescript
// src/lib/machines/queries.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getMachineOwner } from "./queries";
import { db } from "~/server/db";
import {
  machines,
  userProfiles,
  authUsers,
  unconfirmedUsers,
} from "~/server/db/schema";

describe("getMachineOwner", () => {
  beforeEach(async () => {
    await db.delete(machines);
    await db.delete(userProfiles);
    await db.delete(unconfirmedUsers);
  });

  it("returns null when machine has no owner", async () => {
    const [machine] = await db
      .insert(machines)
      .values({
        initials: "MM",
        name: "Medieval Madness",
        ownerId: null,
        unconfirmedOwnerId: null,
      })
      .returning();

    const owner = await getMachineOwner(machine.id);
    expect(owner).toBeNull();
  });

  it("returns activated owner", async () => {
    const [authUser] = await db
      .insert(authUsers)
      .values({
        id: "auth-1",
        email: "owner@example.com",
      })
      .returning();

    const [profile] = await db
      .insert(userProfiles)
      .values({
        id: authUser.id,
        firstName: "John",
        lastName: "Owner",
        role: "member",
      })
      .returning();

    const [machine] = await db
      .insert(machines)
      .values({
        initials: "MM",
        name: "Medieval Madness",
        ownerId: profile.id,
        unconfirmedOwnerId: null,
      })
      .returning();

    const owner = await getMachineOwner(machine.id);
    expect(owner).toMatchObject({
      id: profile.id,
      name: "John Owner",
      email: "owner@example.com",
      status: "active",
    });
  });

  it("returns unconfirmed owner", async () => {
    const [unconfirmed] = await db
      .insert(unconfirmedUsers)
      .values({
        firstName: "Jane",
        lastName: "Pending",
        email: "pending@example.com",
        role: "member",
      })
      .returning();

    const [machine] = await db
      .insert(machines)
      .values({
        initials: "MM",
        name: "Medieval Madness",
        ownerId: null,
        unconfirmedOwnerId: unconfirmed.id,
      })
      .returning();

    const owner = await getMachineOwner(machine.id);
    expect(owner).toMatchObject({
      id: unconfirmed.id,
      name: "Jane Pending",
      email: "pending@example.com",
      status: "unconfirmed",
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/lib/machines/queries.test.ts`
Expected: FAIL - Function not found

### Step 3: Implement getMachineOwner

```typescript
// src/lib/machines/queries.ts
import { db } from "~/server/db";
import {
  machines,
  userProfiles,
  authUsers,
  unconfirmedUsers,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type { MachineOwner } from "~/lib/types";

export async function getMachineOwner(
  machineId: string
): Promise<MachineOwner | null> {
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    with: {
      owner: true,
      unconfirmedOwner: true,
    },
  });

  if (!machine) return null;

  // Check for activated owner
  if (machine.owner) {
    const authUser = await db.query.authUsers.findFirst({
      where: eq(authUsers.id, machine.owner.id),
    });

    return {
      id: machine.owner.id,
      name: machine.owner.name,
      email: authUser?.email ?? "",
      status: "active",
    };
  }

  // Check for unconfirmed owner
  if (machine.unconfirmedOwner) {
    return {
      id: machine.unconfirmedOwner.id,
      name: machine.unconfirmedOwner.name,
      email: machine.unconfirmedOwner.email,
      status: "unconfirmed",
    };
  }

  return null;
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- src/lib/machines/queries.test.ts`
Expected: PASS

### Step 5: Commit machine owner query

```bash
git add src/lib/machines/queries.ts src/lib/machines/queries.test.ts
git commit -m "feat(machines): add getMachineOwner query helper

- Fetches owner for machine (activated or unconfirmed)
- Returns null if no owner
- Add comprehensive tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Email Templates (TDD)

**Files:**

- Create: `src/lib/email/invite.ts`
- Create: `src/lib/email/invite.test.ts`
- Create: `src/lib/email/templates/invite.html`
- Create: `src/lib/email/templates/invite.txt`

### Step 1: Write test for email template functions

```typescript
// src/lib/email/invite.test.ts
import { describe, it, expect } from "vitest";
import { renderInviteEmailHtml, renderInviteEmailText } from "./invite";

describe("Invite email templates", () => {
  it("renders HTML template with variables", () => {
    const html = renderInviteEmailHtml({
      firstName: "John",
      inviterName: "Tim",
      siteUrl: "https://pinpoint.example.com",
      email: "john@example.com",
    });

    expect(html).toContain("Hi John");
    expect(html).toContain("Tim has added you");
    expect(html).toContain(
      "https://pinpoint.example.com/signup?email=john@example.com"
    );
  });

  it("renders text template with variables", () => {
    const text = renderInviteEmailText({
      firstName: "Jane",
      inviterName: "Admin",
      siteUrl: "https://pinpoint.example.com",
      email: "jane@example.com",
    });

    expect(text).toContain("Hi Jane");
    expect(text).toContain("Admin has added you");
    expect(text).toContain(
      "https://pinpoint.example.com/signup?email=jane@example.com"
    );
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/lib/email/invite.test.ts`
Expected: FAIL - Module not found

### Step 3: Create HTML template

```html
<!-- src/lib/email/templates/invite.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        line-height: 1.6;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .button {
        display: inline-block;
        padding: 12px 24px;
        background-color: #0066cc;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        margin: 16px 0;
      }
      ul {
        padding-left: 20px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>You've been invited to PinPoint!</h2>

      <p>Hi {{firstName}},</p>

      <p>
        {{inviterName}} has added you as an owner of pinball machines in
        PinPoint, the issue tracking system for Austin Pinball Collective.
      </p>

      <p><strong>Create your account to get started:</strong></p>
      <a href="{{siteUrl}}/signup?email={{email}}" class="button"
        >Create Account</a
      >

      <p>Once you sign up, you'll be able to:</p>
      <ul>
        <li>View and manage issues for your machines</li>
        <li>Receive notifications about new issues</li>
        <li>Track repair history</li>
      </ul>

      <p>Questions? Reply to this email.</p>

      <p>— The PinPoint Team</p>
    </div>
  </body>
</html>
```

### Step 4: Create text template

```
<!-- src/lib/email/templates/invite.txt -->
You've been invited to PinPoint!

Hi {{firstName}},

{{inviterName}} has added you as an owner of pinball machines in PinPoint, the issue tracking system for Austin Pinball Collective.

Create your account to get started:
{{siteUrl}}/signup?email={{email}}

Once you sign up, you'll be able to:
- View and manage issues for your machines
- Receive notifications about new issues
- Track repair history

Questions? Reply to this email.

— The PinPoint Team
```

### Step 5: Implement template rendering functions

```typescript
// src/lib/email/invite.ts
import fs from "fs";
import path from "path";

interface InviteEmailParams {
  firstName: string;
  inviterName: string;
  siteUrl: string;
  email: string;
}

export function renderInviteEmailHtml(params: InviteEmailParams): string {
  const templatePath = path.join(
    process.cwd(),
    "src/lib/email/templates/invite.html"
  );
  let template = fs.readFileSync(templatePath, "utf-8");

  template = template.replace(/\{\{firstName\}\}/g, params.firstName);
  template = template.replace(/\{\{inviterName\}\}/g, params.inviterName);
  template = template.replace(/\{\{siteUrl\}\}/g, params.siteUrl);
  template = template.replace(
    /\{\{email\}\}/g,
    encodeURIComponent(params.email)
  );

  return template;
}

export function renderInviteEmailText(params: InviteEmailParams): string {
  const templatePath = path.join(
    process.cwd(),
    "src/lib/email/templates/invite.txt"
  );
  let template = fs.readFileSync(templatePath, "utf-8");

  template = template.replace(/\{\{firstName\}\}/g, params.firstName);
  template = template.replace(/\{\{inviterName\}\}/g, params.inviterName);
  template = template.replace(/\{\{siteUrl\}\}/g, params.siteUrl);
  template = template.replace(
    /\{\{email\}\}/g,
    encodeURIComponent(params.email)
  );

  return template;
}
```

### Step 6: Run test to verify it passes

Run: `npm test -- src/lib/email/invite.test.ts`
Expected: PASS

### Step 7: Commit email templates

```bash
git add src/lib/email/invite.ts src/lib/email/invite.test.ts src/lib/email/templates/
git commit -m "feat(email): add invitation email templates

- Add HTML and text templates for user invitations
- Add template rendering functions with variable substitution
- Add tests for template rendering

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Server Action - inviteUserAction (TDD)

**Files:**

- Create: `src/app/(app)/admin/users/actions.ts` (if doesn't exist)
- Create: `src/app/(app)/admin/users/actions.test.ts`

### Step 1: Write failing test for inviteUserAction

```typescript
// src/app/(app)/admin/users/actions.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { inviteUserAction } from "./actions";
import { db } from "~/server/db";
import { userProfiles, authUsers, unconfirmedUsers } from "~/server/db/schema";

// Mock Resend
vi.mock("~/lib/email/invite", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("inviteUserAction", () => {
  beforeEach(async () => {
    await db.delete(unconfirmedUsers);
  });

  it("creates unconfirmed user without sending invite", async () => {
    const formData = new FormData();
    formData.append("firstName", "John");
    formData.append("lastName", "Doe");
    formData.append("email", "john@example.com");
    formData.append("role", "member");

    const result = await inviteUserAction(formData);

    expect(result.ok).toBe(true);
    expect(result.userId).toBeDefined();

    const users = await db.select().from(unconfirmedUsers);
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("john@example.com");
  });

  it("rejects invalid email", async () => {
    const formData = new FormData();
    formData.append("firstName", "John");
    formData.append("lastName", "Doe");
    formData.append("email", "invalid-email");
    formData.append("role", "member");

    const result = await inviteUserAction(formData);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("email");
  });

  it("prevents duplicate email", async () => {
    // Create existing unconfirmed user
    await db.insert(unconfirmedUsers).values({
      firstName: "Existing",
      lastName: "User",
      email: "existing@example.com",
      role: "guest",
    });

    const formData = new FormData();
    formData.append("firstName", "New");
    formData.append("lastName", "User");
    formData.append("email", "existing@example.com");
    formData.append("role", "member");

    const result = await inviteUserAction(formData);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("already exists");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/app/(app)/admin/users/actions.test.ts`
Expected: FAIL - Module not found

### Step 3: Implement inviteUserAction

```typescript
// src/app/(app)/admin/users/actions.ts
"use server";

import { z } from "zod";
import { db } from "~/server/db";
import { unconfirmedUsers, authUsers } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import {
  renderInviteEmailHtml,
  renderInviteEmailText,
} from "~/lib/email/invite";
import { Resend } from "resend";
import { createClient } from "~/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

const inviteUserSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  role: z.enum(["guest", "member", "admin"]),
  sendInvite: z.boolean().optional(),
});

export type InviteUserResult =
  | { ok: true; userId: string; message: string }
  | { ok: false; message: string };

export async function inviteUserAction(
  formData: FormData
): Promise<InviteUserResult> {
  // Verify admin permission
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Unauthorized" };
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (profile?.role !== "admin") {
    return { ok: false, message: "Admin permission required" };
  }

  // Validate input
  const rawData = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    role: formData.get("role"),
    sendInvite: formData.get("sendInvite") === "true",
  };

  const parsed = inviteUserSchema.safeParse(rawData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0].message };
  }

  const { firstName, lastName, email, role, sendInvite } = parsed.data;

  // Check for duplicates
  const existingUnconfirmed = await db.query.unconfirmedUsers.findFirst({
    where: eq(unconfirmedUsers.email, email),
  });

  if (existingUnconfirmed) {
    return { ok: false, message: "Email already exists as unconfirmed user" };
  }

  const existingAuth = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, email),
  });

  if (existingAuth) {
    return { ok: false, message: "Email already exists as registered user" };
  }

  // Create unconfirmed user
  const [newUser] = await db
    .insert(unconfirmedUsers)
    .values({
      firstName,
      lastName,
      email,
      role,
      inviteSentAt: sendInvite ? new Date() : null,
    })
    .returning();

  // Send invite if requested
  if (sendInvite) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const html = renderInviteEmailHtml({
      firstName,
      inviterName: profile.name,
      siteUrl,
      email,
    });
    const text = renderInviteEmailText({
      firstName,
      inviterName: profile.name,
      siteUrl,
      email,
    });

    await resend.emails.send({
      from: "PinPoint <noreply@pinpoint.app>",
      to: email,
      subject: "You've been invited to PinPoint",
      html,
      text,
    });
  }

  return {
    ok: true,
    userId: newUser.id,
    message: sendInvite
      ? `Invitation sent to ${email}`
      : `User created successfully`,
  };
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- src/app/(app)/admin/users/actions.test.ts`
Expected: PASS

### Step 5: Commit server action

```bash
git add src/app/(app)/admin/users/actions.ts src/app/(app)/admin/users/actions.test.ts
git commit -m "feat(admin): add inviteUserAction server action

- Create unconfirmed users with validation
- Send invitation emails via Resend
- Check for duplicate emails
- Require admin permission
- Add comprehensive tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Integration Test - Auto-linking (TDD)

**Files:**

- Create: `src/test/integration/supabase/unconfirmed-users.test.ts`

### Step 1: Write integration test for auto-linking

```typescript
// src/test/integration/supabase/unconfirmed-users.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "~/server/db";
import {
  machines,
  issues,
  userProfiles,
  authUsers,
  unconfirmedUsers,
} from "~/server/db/schema";

describe("Unconfirmed user auto-linking", () => {
  beforeEach(async () => {
    await db.delete(issues);
    await db.delete(machines);
    await db.delete(userProfiles);
    await db.delete(authUsers);
    await db.delete(unconfirmedUsers);
  });

  it("links machine owner on user signup", async () => {
    // Create unconfirmed user
    const [unconfirmed] = await db
      .insert(unconfirmedUsers)
      .values({
        firstName: "John",
        lastName: "Owner",
        email: "owner@example.com",
        role: "member",
      })
      .returning();

    // Create machine with unconfirmed owner
    const [machine] = await db
      .insert(machines)
      .values({
        initials: "MM",
        name: "Medieval Madness",
        unconfirmedOwnerId: unconfirmed.id,
      })
      .returning();

    // Simulate signup: create auth user
    const [authUser] = await db
      .insert(authUsers)
      .values({
        id: crypto.randomUUID(),
        email: "owner@example.com",
      })
      .returning();

    // Create profile (this triggers the auto-link)
    await db.insert(userProfiles).values({
      id: authUser.id,
      firstName: "John",
      lastName: "Owner",
      role: "member",
    });

    // Verify machine owner was transferred
    const updatedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });

    expect(updatedMachine?.ownerId).toBe(authUser.id);
    expect(updatedMachine?.unconfirmedOwnerId).toBeNull();

    // Verify unconfirmed user was deleted
    const remainingUnconfirmed = await db.select().from(unconfirmedUsers);
    expect(remainingUnconfirmed).toHaveLength(0);
  });

  it("links issue reporter on user signup", async () => {
    // Create unconfirmed user
    const [unconfirmed] = await db
      .insert(unconfirmedUsers)
      .values({
        firstName: "Anonymous",
        lastName: "Reporter",
        email: "reporter@example.com",
        role: "guest",
      })
      .returning();

    // Create machine first
    const [machine] = await db
      .insert(machines)
      .values({
        initials: "MM",
        name: "Medieval Madness",
      })
      .returning();

    // Create issue with unconfirmed reporter
    const [issue] = await db
      .insert(issues)
      .values({
        machineInitials: machine.initials,
        issueNumber: 1,
        title: "Test Issue",
        severity: "minor",
        unconfirmedReportedBy: unconfirmed.id,
      })
      .returning();

    // Simulate signup
    const [authUser] = await db
      .insert(authUsers)
      .values({
        id: crypto.randomUUID(),
        email: "reporter@example.com",
      })
      .returning();

    await db.insert(userProfiles).values({
      id: authUser.id,
      firstName: "Anonymous",
      lastName: "Reporter",
      role: "guest",
    });

    // Verify issue reporter was transferred
    const updatedIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issue.id),
    });

    expect(updatedIssue?.reportedBy).toBe(authUser.id);
    expect(updatedIssue?.unconfirmedReportedBy).toBeNull();
  });

  it("transfers role from unconfirmed user to profile", async () => {
    // Create unconfirmed user with admin role
    await db.insert(unconfirmedUsers).values({
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      role: "admin",
    });

    // Simulate signup
    const [authUser] = await db
      .insert(authUsers)
      .values({
        id: crypto.randomUUID(),
        email: "admin@example.com",
      })
      .returning();

    await db.insert(userProfiles).values({
      id: authUser.id,
      firstName: "Admin",
      lastName: "User",
      role: "member", // Default role
    });

    // Verify role was transferred
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, authUser.id),
    });

    expect(profile?.role).toBe("admin");
  });
});
```

### Step 2: Run test to verify it passes (trigger exists)

Run: `npm run test:integration -- src/test/integration/supabase/unconfirmed-users.test.ts`
Expected: PASS (trigger should work)

### Step 3: Commit integration tests

```bash
git add src/test/integration/supabase/unconfirmed-users.test.ts
git commit -m "test(integration): add auto-linking integration tests

- Test machine owner transfer on signup
- Test issue reporter transfer on signup
- Test role transfer from unconfirmed user
- Verify cleanup of unconfirmed user record

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Update Public Report Form (TDD)

**Files:**

- Modify: `src/app/report/page.tsx`
- Modify: `src/app/report/actions.ts`
- Modify: `src/app/report/validation.ts`

### Step 1: Write E2E test for email capture

```typescript
// e2e/smoke/public-reporting.spec.ts
// Add to existing file

test("public form accepts optional email", async ({ page }) => {
  await page.goto("/report");

  // Fill form with email
  await page.selectOption('[data-testid="machine-select"]', {
    index: 1,
  });
  await page.fill('input[name="title"]', "Test issue with email");
  await page.fill('textarea[name="description"]', "Description here");
  await page.selectOption('select[name="severity"]', "minor");
  await page.fill('input[name="email"]', "reporter@example.com");

  await page.click('button[type="submit"]');

  await page.waitForURL("/report/success");
  expect(page.url()).toContain("/report/success");
});

test("public form works without email", async ({ page }) => {
  await page.goto("/report");

  await page.selectOption('[data-testid="machine-select"]', {
    index: 1,
  });
  await page.fill('input[name="title"]', "Test issue without email");
  await page.selectOption('select[name="severity"]', "playable");

  await page.click('button[type="submit"]');

  await page.waitForURL("/report/success");
  expect(page.url()).toContain("/report/success");
});
```

### Step 2: Run E2E test to verify it fails

Run: `npm run smoke -- e2e/smoke/public-reporting.spec.ts`
Expected: FAIL - Email field not found

### Step 3: Add email field to report form

```tsx
// src/app/report/page.tsx
// Add after description field, before severity field

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

### Step 4: Update validation schema

```typescript
// src/app/report/validation.ts

export const publicIssueSchema = z.object({
  machineId: z.string().uuid("Valid machine required"),
  title: z.string().min(1, "Title required").max(200, "Title too long"),
  description: z.string().max(2000, "Description too long").optional(),
  severity: z.enum(["minor", "playable", "unplayable"]),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
});
```

### Step 5: Update submitPublicIssueAction

```typescript
// src/app/report/actions.ts

export async function submitPublicIssueAction(
  formData: FormData
): Promise<void> {
  // ... existing honeypot and rate limit checks

  const parsed = parsePublicIssueForm(formData);
  if (!parsed.success) {
    redirectWithError(parsed.error);
    return;
  }

  const parsedData = parsed.data;
  const { machineId, title, description, severity, email } = parsedData;

  // ... existing machine resolution

  let unconfirmedReporterId: string | null = null;

  // Handle optional email
  if (email && email.trim() !== "") {
    // Find or create unconfirmed user
    let unconfirmedUser = await db.query.unconfirmedUsers.findFirst({
      where: eq(unconfirmedUsers.email, email),
    });

    if (!unconfirmedUser) {
      [unconfirmedUser] = await db
        .insert(unconfirmedUsers)
        .values({
          firstName: "Anonymous",
          lastName: "Reporter",
          email,
          role: "guest",
        })
        .returning();
    }

    unconfirmedReporterId = unconfirmedUser.id;
  }

  try {
    await createIssue({
      title,
      description: description ?? null,
      machineInitials: machine.initials,
      severity,
      reportedBy: null,
      unconfirmedReportedBy: unconfirmedReporterId,
    });

    // ... rest of function
  }
}
```

### Step 6: Update createIssue signature

```typescript
// src/services/issues.ts

interface CreateIssueInput {
  title: string;
  description: string | null;
  machineInitials: string;
  severity: "minor" | "playable" | "unplayable";
  reportedBy: string | null;
  unconfirmedReportedBy?: string | null; // Add this
}

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  // ... implementation
}
```

### Step 7: Run E2E test to verify it passes

Run: `npm run smoke -- e2e/smoke/public-reporting.spec.ts`
Expected: PASS

### Step 8: Commit public report updates

```bash
git add src/app/report/page.tsx src/app/report/actions.ts src/app/report/validation.ts src/services/issues.ts e2e/smoke/public-reporting.spec.ts
git commit -m "feat(report): add optional email capture to public form

- Add email input field to public report form
- Create/find unconfirmed user when email provided
- Link issue to unconfirmed reporter
- Update validation schema
- Add E2E tests for email capture

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Run Full Test Suite & Build

**Files:**

- None (verification step)

### Step 1: Run unit tests

Run: `npm test`
Expected: All unit tests pass

### Step 2: Run integration tests

Run: `npm run test:integration`
Expected: All integration tests pass

### Step 3: Run type check

Run: `npm run typecheck`
Expected: No TypeScript errors

### Step 4: Run build

Run: `npm run build`
Expected: Build succeeds

### Step 5: Run smoke tests

Run: `npm run smoke`
Expected: All E2E tests pass

### Step 6: Commit if any fixes needed

If any tests revealed issues, fix them and commit:

```bash
git add <fixed-files>
git commit -m "fix: address test failures

<describe fixes>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Next Steps

After completing this implementation plan, the following features will still need to be implemented:

1. **InviteUserDialog Component** - Reusable dialog for inviting users
2. **Updated OwnerSelect Component** - Show both activated and unconfirmed owners
3. **Updated Admin Users Page** - Unified view with resend invite
4. **resendInviteAction** - Server action for resending invites
5. **updateUserRoleAction** - Support both user types

These can be implemented as follow-up tasks using the same TDD approach.

---

## Summary

This plan implements the core infrastructure for unconfirmed users:

- ✅ Database schema with auto-linking trigger
- ✅ Type definitions for unified users
- ✅ Query helpers for fetching users and owners
- ✅ Email templates for invitations
- ✅ Server action for inviting users
- ✅ Integration tests for auto-linking
- ✅ Public form email capture
- ✅ Full test suite verification

**Estimated Time:** 4-6 hours for experienced developer following TDD

**Verification:** All tests pass, build succeeds, no TypeScript errors
