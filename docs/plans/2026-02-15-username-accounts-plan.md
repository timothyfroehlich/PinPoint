# Username-Only Accounts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support admin-created username-only accounts using a `@pinpoint.internal` email facade so users who won't share their email can still log in.

**Architecture:** All accounts still use Supabase Auth's email-based system. Username accounts use `{username}@pinpoint.internal` as their email. A single `isInternalAccount()` utility centralizes detection. The login form silently appends the domain when no `@` is present. No schema changes needed.

**Tech Stack:** TypeScript, Zod, Supabase Admin API, Next.js Server Components, Playwright, Vitest

**Design doc:** `docs/plans/2026-02-15-username-accounts-design.md`

---

### Task 1: Internal Account Utility

**Files:**

- Create: `src/lib/auth/internal-accounts.ts`
- Test: `src/lib/auth/internal-accounts.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/auth/internal-accounts.test.ts
import { describe, it, expect } from "vitest";
import {
  isInternalAccount,
  usernameToInternalEmail,
} from "./internal-accounts";

describe("isInternalAccount", () => {
  it("returns true for @pinpoint.internal emails", () => {
    expect(isInternalAccount("jdoe@pinpoint.internal")).toBe(true);
  });

  it("returns false for regular emails", () => {
    expect(isInternalAccount("user@example.com")).toBe(false);
  });

  it("returns false for partial domain match", () => {
    expect(isInternalAccount("user@notpinpoint.internal")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isInternalAccount("")).toBe(false);
  });
});

describe("usernameToInternalEmail", () => {
  it("converts username to internal email", () => {
    expect(usernameToInternalEmail("jdoe")).toBe("jdoe@pinpoint.internal");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/auth/internal-accounts.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/lib/auth/internal-accounts.ts
const INTERNAL_DOMAIN = "pinpoint.internal";

/** Check if an email belongs to an admin-created username-only account. */
export function isInternalAccount(email: string): boolean {
  return email.endsWith(`@${INTERNAL_DOMAIN}`);
}

/** Convert a plain username to its internal email representation. */
export function usernameToInternalEmail(username: string): string {
  return `${username}@${INTERNAL_DOMAIN}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/auth/internal-accounts.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/lib/auth/internal-accounts.ts src/lib/auth/internal-accounts.test.ts
git commit -m "feat: add internal account utility for username-only accounts"
```

---

### Task 2: Login Schema — Accept Username or Email

**Files:**

- Modify: `src/app/(auth)/schemas.ts` (lines 11-16, the `loginSchema.email` field)
- Modify: `src/app/(auth)/schemas.test.ts` (add loginSchema tests)

**Step 1: Write the failing tests**

Add a new `describe("loginSchema")` block to `src/app/(auth)/schemas.test.ts`:

```typescript
// Add to imports at top:
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas";

// Add new describe block:
describe("loginSchema", () => {
  it("should accept valid email with password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "TestPassword123",
    });
    expect(result.success).toBe(true);
  });

  it("should accept plain username (no @) with password", () => {
    const result = loginSchema.safeParse({
      email: "jdoe",
      password: "TestPassword123",
    });
    expect(result.success).toBe(true);
  });

  it("should accept alphanumeric username with underscores", () => {
    const result = loginSchema.safeParse({
      email: "john_doe_42",
      password: "TestPassword123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty email/username", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "TestPassword123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password-only (no email)", () => {
    const result = loginSchema.safeParse({
      password: "TestPassword123",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify failure**

Run: `pnpm vitest run src/app/\(auth\)/schemas.test.ts`
Expected: FAIL — "jdoe" fails `.email()` validation

**Step 3: Update the login schema**

In `src/app/(auth)/schemas.ts`, change the `email` field in `loginSchema` from:

```typescript
email: z
  .string()
  .email("Please enter a valid email address")
  .max(254, "Email is too long"),
```

To:

```typescript
email: z
  .string()
  .min(1, "Email or username is required")
  .max(254, "Input is too long")
  .refine(
    (val) => val.includes("@") ? z.string().email().safeParse(val).success : /^[a-zA-Z0-9_]+$/.test(val),
    "Please enter a valid email address or username"
  ),
```

This accepts either a valid email (has `@` and passes `.email()`) or a plain alphanumeric username (no `@`, only letters/numbers/underscores).

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/\(auth\)/schemas.test.ts`
Expected: PASS (all tests)

**Step 5: Run full check**

Run: `pnpm run check`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/\(auth\)/schemas.ts src/app/\(auth\)/schemas.test.ts
git commit -m "feat: login schema accepts username or email"
```

---

### Task 3: Login Action — Append Internal Domain

**Files:**

- Modify: `src/app/(auth)/actions.ts` (around line 84, after `const { email, password } = parsed.data`)

**Step 1: Add the import and domain translation**

At the top of `src/app/(auth)/actions.ts`, add the import:

```typescript
import { usernameToInternalEmail } from "~/lib/auth/internal-accounts";
```

Then after line 84 (`const { email, password } = parsed.data;`), add:

```typescript
// If input has no @, treat it as a username and convert to internal email
const authEmail = email.includes("@") ? email : usernameToInternalEmail(email);
```

Then update the two places that use `email` for auth:

1. Line 106: `checkLoginAccountLimit(email)` → `checkLoginAccountLimit(authEmail)`
2. Line 134: `signInWithPassword({ email, ...})` → `signInWithPassword({ email: authEmail, ...})`

**Important:** Keep `submittedEmail` using the original `email` value (what the user typed) so the form repopulates correctly on error.

**Step 2: Verify typecheck passes**

Run: `pnpm run check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/\(auth\)/actions.ts
git commit -m "feat: login action translates username to internal email"
```

---

### Task 4: Login Form — Input Type Change

**Files:**

- Modify: `src/app/(auth)/login/login-form.tsx` (line 64)

**Step 1: Change input type**

In `src/app/(auth)/login/login-form.tsx`, change the email Input's `type` prop from `"email"` to `"text"`:

```typescript
// Line 64: change type="email" to type="text"
type = "text";
```

This is needed because HTML `<input type="email">` rejects values without an `@` sign, which would prevent username entry.

**Step 2: Verify typecheck passes**

Run: `pnpm run check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/\(auth\)/login/login-form.tsx
git commit -m "feat: login input accepts text (supports username entry)"
```

---

### Task 5: Notification Email Skip

**Files:**

- Modify: `src/lib/notifications.ts` (around line 252, the email send block)

**Step 1: Add the import**

At the top of `src/lib/notifications.ts`, add:

```typescript
import { isInternalAccount } from "~/lib/auth/internal-accounts";
```

**Step 2: Skip email for internal accounts**

In the email section (around line 252), change:

```typescript
// Email
if (prefs.emailEnabled && emailNotify) {
  const email = emailMap.get(userId);

  if (email) {
    emailsToSend.push({
```

To:

```typescript
// Email (skip internal accounts — they have no real email)
if (prefs.emailEnabled && emailNotify) {
  const email = emailMap.get(userId);

  if (email && !isInternalAccount(email)) {
    emailsToSend.push({
```

The only change is adding `&& !isInternalAccount(email)` to the `if` condition.

**Step 3: Verify typecheck passes**

Run: `pnpm run check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: skip email notifications for internal accounts"
```

---

### Task 6: Settings Page — Internal Account Display

**Files:**

- Modify: `src/app/(app)/settings/page.tsx` (pass `isInternalAccount` flag to forms)
- Modify: `src/app/(app)/settings/profile-form.tsx` (conditional email display)
- Modify: `src/app/(app)/settings/notifications/notification-preferences-form.tsx` (hide email toggles)

**Step 1: Update settings page to pass the flag**

In `src/app/(app)/settings/page.tsx`, add import and pass prop:

```typescript
import { isInternalAccount } from "~/lib/auth/internal-accounts";
```

Then where `<ProfileForm>` is rendered (around line 60), add the prop:

```tsx
<ProfileForm
  firstName={profile.firstName}
  lastName={profile.lastName}
  email={profile.email}
  role={profile.role}
  isInternalAccount={isInternalAccount(profile.email)}
/>
```

And where `<NotificationPreferencesForm>` is rendered (around line 75), wrap it:

```tsx
{isInternalAccount(profile.email) ? (
  <p className="text-sm text-muted-foreground">
    Email notifications are not available for username accounts.
  </p>
) : (
  <NotificationPreferencesForm preferences={{...}} />
)}
```

**Step 2: Update ProfileForm to handle internal accounts**

In `src/app/(app)/settings/profile-form.tsx`:

1. Add `isInternalAccount?: boolean` to `ProfileFormProps` interface (line 16)
2. Add it to the destructured props (line 22)
3. Change the email Input (lines 84-91) to show different content for internal accounts:

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  {isInternalAccount ? (
    <p className="text-sm text-muted-foreground py-2">
      Username account — no email on file
    </p>
  ) : (
    <Input
      id="email"
      name="email"
      value={email}
      disabled
      className="max-w-[240px] bg-muted"
    />
  )}
</div>
```

**Step 3: Verify typecheck passes**

Run: `pnpm run check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(app\)/settings/page.tsx src/app/\(app\)/settings/profile-form.tsx src/app/\(app\)/settings/notifications/notification-preferences-form.tsx
git commit -m "feat: settings page handles internal accounts gracefully"
```

---

### Task 7: Seed Test User

**Files:**

- Modify: `src/test/data/users.json` (add `usernameAccount` entry)
- Modify: `supabase/seed-users.mjs` (handle the new user, print its credentials)

**Step 1: Add test user to users.json**

Add a new entry to `src/test/data/users.json`:

```json
{
  "admin": { ... },
  "member": { ... },
  "guest": { ... },
  "usernameAccount": {
    "email": "testuser@pinpoint.internal",
    "password": "TestPassword123",
    "role": "member",
    "name": "Test Username Account",
    "firstName": "Test",
    "lastName": "Username"
  }
}
```

**Step 2: Update seed script to print username account info**

In `supabase/seed-users.mjs`, update the final `console.log` block (around line 756) to include:

```javascript
console.log("  testuser@pinpoint.internal (Username account, Member role)");
console.log("    └─ Login with username: testuser");
```

**Step 3: Update the userIds tracking**

The existing seed loop iterates `Object.values(usersData)` and uses `user.role` as the key in `userIds`. Since the new user also has role `member`, change the key to use a unique identifier. In the seed user loop, change:

```javascript
userIds[user.role] = userId;
```

To use the JSON key instead. Since `TEST_USERS` is from `Object.values()`, switch to `Object.entries()`:

```javascript
const TEST_USERS = Object.entries(usersData);

// In the loop:
for (const [key, user] of TEST_USERS) {
  // ... existing creation logic ...
  userIds[key] = userId; // Use JSON key instead of role
}
```

Then update all references from `userIds.admin` → `userIds.admin`, `userIds.member` → `userIds.member`, `userIds.guest` → `userIds.guest` (same names, since the JSON keys match).

**Step 4: Verify seed runs**

Run: `pnpm run db:seed` (or the applicable seed command)
Expected: All users created including `testuser@pinpoint.internal`

**Step 5: Commit**

```bash
git add src/test/data/users.json supabase/seed-users.mjs
git commit -m "feat: add username test account to seed data"
```

---

### Task 8: Admin Help Page

**Files:**

- Create: `src/app/(app)/help/admin/page.tsx`
- Modify: `src/app/(app)/help/page.tsx` (make async, add admin button)

**Step 1: Create the admin help page**

Create `src/app/(app)/help/admin/page.tsx` as a Server Component:

```tsx
import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PageShell } from "~/components/layout/PageShell";
import { Forbidden } from "~/components/errors/Forbidden";

export const metadata = {
  title: "Admin Help | PinPoint",
};

export default async function AdminHelpPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  if (profile?.role !== "admin") {
    return <Forbidden role={profile?.role ?? null} />;
  }

  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/help" className="text-primary underline">
            Help
          </Link>
          <span>/</span>
          <span>Admin</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Help</h1>
        <p className="text-sm text-muted-foreground">
          Administrative procedures for managing PinPoint.
        </p>
      </header>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Username-Only Accounts</h2>
        <p className="text-sm text-muted-foreground">
          Some users prefer not to share their email address. PinPoint supports
          admin-created &ldquo;username accounts&rdquo; that use a username and
          password instead of an email.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h3 className="text-base font-semibold">Creating a Username Account</h3>
        <p className="text-sm text-muted-foreground">
          Run the following script from the project root (requires access to the
          server environment):
        </p>
        <pre className="bg-muted rounded-md p-4 text-sm overflow-x-auto">
          {`./scripts/admin-username-account.mjs \\
  --username jdoe \\
  --first "John" --last "Doe" \\
  --role member`}
        </pre>
        <p className="text-sm text-muted-foreground">
          The script generates a random password and prints it. Give the
          username and password to the user (verbally or on paper). They log in
          by typing their username in the Email field on the login page.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h3 className="text-base font-semibold">Resetting a Password</h3>
        <p className="text-sm text-muted-foreground">
          Username account users cannot use &ldquo;Forgot Password&rdquo; since
          they have no email. To reset their password:
        </p>
        <pre className="bg-muted rounded-md p-4 text-sm overflow-x-auto">
          {`./scripts/admin-username-account.mjs \\
  --reset-password --username jdoe`}
        </pre>
        <p className="text-sm text-muted-foreground">
          Give the new password to the user. They can change it in Settings
          after logging in.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h3 className="text-base font-semibold">Limitations</h3>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
          <li>
            <strong>No email notifications</strong> — username accounts will
            never receive email notifications. In-app notifications still work.
          </li>
          <li>
            <strong>No self-service password reset</strong> — the user must
            contact an admin to reset their password.
          </li>
          <li>
            <strong>No invite flow</strong> — the account is created directly
            via the script, not through the invite system.
          </li>
        </ul>
      </section>
    </PageShell>
  );
}
```

**Step 2: Update the help page to show admin button**

Modify `src/app/(app)/help/page.tsx`:

1. Make it async and add auth imports
2. Add admin role check
3. Add a conditional "Admin Help" button at the bottom

Change the function signature from:

```typescript
export default function HelpPage(): React.JSX.Element {
```

To:

```typescript
export default async function HelpPage(): Promise<React.JSX.Element> {
```

Add imports at the top:

```typescript
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
```

At the start of the function body, add:

```typescript
let isAdmin = false;
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (user) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  isAdmin = profile?.role === "admin";
}
```

Then add a conditional section before the closing `</PageShell>`:

```tsx
{
  isAdmin && (
    <section className="mt-8 pt-6 border-t">
      <Link
        href="/help/admin"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Admin Help
      </Link>
    </section>
  );
}
```

**Step 3: Verify typecheck passes**

Run: `pnpm run check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(app\)/help/admin/page.tsx src/app/\(app\)/help/page.tsx
git commit -m "feat: add admin help page with username account documentation"
```

---

### Task 9: Admin Script

**Files:**

- Create: `scripts/admin-username-account.mjs`

**Step 1: Write the script**

Create `scripts/admin-username-account.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Admin Username Account Management
 *
 * Creates and manages username-only accounts that use @pinpoint.internal
 * email addresses. These accounts let users log in with a username instead
 * of a real email.
 *
 * Usage:
 *   Create:  ./scripts/admin-username-account.mjs --username jdoe --first "John" --last "Doe" --role member
 *   Reset:   ./scripts/admin-username-account.mjs --reset-password --username jdoe
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 * Load env: node --env-file=.env.local scripts/admin-username-account.mjs ...
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { parseArgs } from "util";

const INTERNAL_DOMAIN = "pinpoint.internal";

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function usernameToEmail(username) {
  return `${username}@${INTERNAL_DOMAIN}`;
}

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    username: { type: "string" },
    first: { type: "string" },
    last: { type: "string" },
    role: { type: "string", default: "member" },
    "reset-password": { type: "boolean", default: false },
  },
});

if (!values.username) {
  console.error("Error: --username is required");
  console.error("\nUsage:");
  console.error(
    '  Create: node --env-file=.env.local scripts/admin-username-account.mjs --username jdoe --first "John" --last "Doe" --role member'
  );
  console.error(
    "  Reset:  node --env-file=.env.local scripts/admin-username-account.mjs --reset-password --username jdoe"
  );
  process.exit(1);
}

// Validate username format
if (!/^[a-zA-Z0-9_]+$/.test(values.username)) {
  console.error(
    "Error: Username must contain only letters, numbers, and underscores"
  );
  process.exit(1);
}

// Environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Error: Missing environment variables.");
  console.error(
    "  Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  console.error(
    "  Tip: node --env-file=.env.local scripts/admin-username-account.mjs ..."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = usernameToEmail(values.username);

if (values["reset-password"]) {
  // ── Reset Password Mode ──
  // Look up user by email
  const { data: userList, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  const user = userList.users.find((u) => u.email === email);
  if (!user) {
    console.error(`Error: No account found for username "${values.username}"`);
    process.exit(1);
  }

  const newPassword = generatePassword();
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    console.error("Error resetting password:", updateError.message);
    process.exit(1);
  }

  console.log("\nPassword reset successfully!");
  console.log(`  Username: ${values.username}`);
  console.log(`  New Password: ${newPassword}`);
  console.log("\nGive this password to the user.");
} else {
  // ── Create Mode ──
  if (!values.first || !values.last) {
    console.error(
      "Error: --first and --last are required for account creation"
    );
    process.exit(1);
  }

  const validRoles = ["guest", "member", "admin"];
  if (!validRoles.includes(values.role)) {
    console.error(`Error: --role must be one of: ${validRoles.join(", ")}`);
    process.exit(1);
  }

  const password = generatePassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: values.first,
      last_name: values.last,
    },
  });

  if (error) {
    console.error("Error creating account:", error.message);
    process.exit(1);
  }

  console.log("\nAccount created successfully!");
  console.log(`  User ID:  ${data.user.id}`);
  console.log(`  Username: ${values.username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Name:     ${values.first} ${values.last}`);
  console.log(`  Role:     ${values.role}`);
  console.log("\nGive the username and password to the user.");
  console.log('They log in by typing their username in the "Email" field.');

  // Note: The DB trigger auto-creates user_profiles, but the role defaults to "guest".
  // If the desired role is different, we need to update it.
  // The seed script does this with a direct SQL query, but for this admin script
  // we rely on the DB trigger + a manual role update if needed.
  if (values.role !== "guest") {
    console.log(
      `\nNote: The DB trigger sets role to "guest" by default. Update the role via the Admin > Users panel.`
    );
  }
}
```

**Step 2: Make it executable**

```bash
chmod +x scripts/admin-username-account.mjs
```

**Step 3: Verify it runs (syntax check)**

```bash
node --env-file=.env.local scripts/admin-username-account.mjs --help 2>&1 || true
```

Expected: Shows usage error (no --username), confirming script parses correctly.

**Step 4: Commit**

```bash
git add scripts/admin-username-account.mjs
git commit -m "feat: add admin script for username account creation and password reset"
```

---

### Task 10: E2E Test — Username Login

**Files:**

- Create: `e2e/smoke/username-login.spec.ts`

**Prereq:** Task 7 (seed test user) must be complete and DB reseeded.

**Step 1: Write the E2E test**

```typescript
// e2e/smoke/username-login.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Username Account Login", () => {
  test("login with username (no @) redirects to dashboard", async ({
    page,
  }, testInfo) => {
    await page.goto("/login");

    // Type just the username, not the email
    await page.getByLabel("Email").fill("testuser");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Verify we're logged in
    const isMobile = testInfo.project.name.includes("Mobile");
    if (isMobile) {
      await expect(page.getByTestId("mobile-menu-trigger")).toBeVisible();
    } else {
      await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
    }
  });
});
```

**Step 2: Run the test**

Run: `pnpm exec playwright test e2e/smoke/username-login.spec.ts --project="Desktop Chrome"`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/smoke/username-login.spec.ts
git commit -m "test: e2e test for username login flow"
```

---

### Task 11: E2E Test — Settings Page for Username Account

**Files:**

- Create: `e2e/full/username-account-settings.spec.ts`

**Step 1: Write the E2E test**

```typescript
// e2e/full/username-account-settings.spec.ts
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";

test.describe("Username Account Settings", () => {
  test("settings page shows 'no email on file' for username accounts", async ({
    page,
  }, testInfo) => {
    // Login as the username test account
    await loginAs(page, testInfo, {
      email: "testuser",
      password: "TestPassword123",
    });

    await page.goto("/settings");

    const profileForm = page.getByTestId("profile-form");

    // Should NOT show the email input
    await expect(profileForm.getByLabel("Email")).not.toBeVisible();

    // Should show the "no email" message
    await expect(profileForm.getByText("Username account")).toBeVisible();
  });

  test("notification preferences section shows email unavailable message", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: "testuser",
      password: "TestPassword123",
    });

    await page.goto("/settings");

    // Should show the "not available" message instead of the full notification form
    await expect(
      page.getByText("Email notifications are not available")
    ).toBeVisible();

    // Should NOT show the email notifications toggle
    await expect(
      page.getByTestId("notification-preferences-form")
    ).not.toBeVisible();
  });
});
```

**Step 2: Run the test**

Run: `pnpm exec playwright test e2e/full/username-account-settings.spec.ts --project="Desktop Chrome"`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/full/username-account-settings.spec.ts
git commit -m "test: e2e tests for username account settings page"
```

---

### Task 12: Final Verification

**Step 1: Run full preflight**

Run: `pnpm run preflight`
Expected: PASS (types, lint, format, unit tests, build, integration tests)

**Step 2: Run E2E smoke suite**

Run: `pnpm exec playwright test e2e/smoke/ --project="Desktop Chrome"`
Expected: PASS (including existing auth-flows.spec.ts — verify regular email login still works)

**Step 3: Run full E2E suite**

Run: `pnpm run e2e:full`
Expected: PASS

**Step 4: Final commit if any formatting/lint fixes needed**

```bash
git add -A
git commit -m "chore: formatting and lint fixes from preflight"
```

---

## Task Dependency Graph

```
Task 1 (utility) ──────┬──> Task 2 (schema) ──> Task 3 (action) ──> Task 4 (form)
                        ├──> Task 5 (notifications)
                        ├──> Task 6 (settings)
                        └──> Task 9 (admin script)

Task 7 (seed data) ────┬──> Task 10 (E2E login)
                        └──> Task 11 (E2E settings) ── requires Task 6

Task 8 (help page) ────── independent

Task 12 (verification) ── after all others
```

**Parallelizable groups:**

- After Task 1: Tasks 2, 5, 6, 8, 9 can all start
- After Task 7: Tasks 10, 11 can start (once their code deps are done)
- Tasks 2→3→4 must be sequential
