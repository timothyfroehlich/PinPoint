# Change Password in Settings — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Change Password" section to the Settings page so authenticated users (email and username accounts) can update their password.

**Architecture:** New `ChangePasswordSection` client component placed between Notification Preferences and Danger Zone on the existing `/settings` page. Server action verifies the current password via `signInWithPassword()` before updating via `updateUser()`. Follows the existing `Result<T, C>` pattern for error handling.

**Tech Stack:** Next.js Server Actions, Supabase Auth, Zod validation, React `useActionState`, shadcn/ui components, Vitest (unit), Playwright (E2E)

**Skills:** @pinpoint-patterns (server actions), @pinpoint-security (auth flows), @pinpoint-testing (unit test patterns), @pinpoint-e2e (E2E patterns), @pinpoint-ui (form components)

---

### Task 1: Server Action — Schema + Action

**Files:**

- Modify: `src/app/(app)/settings/actions.ts` (add schema + action at end of file)

**Step 1: Add the Zod schema and Result type**

Add after the existing `deleteAccountSchema` block (around line 100):

```ts
// --- Change Password ---

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required")
      .max(1000, "Password is too long"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be less than 128 characters"),
    confirmNewPassword: z
      .string()
      .max(128, "Password must be less than 128 characters"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordResult = Result<
  { success: boolean },
  "VALIDATION" | "UNAUTHORIZED" | "WRONG_PASSWORD" | "SERVER"
>;
```

**Step 2: Add the server action**

Add after the schema:

```ts
/**
 * Change Password Action
 *
 * Allows authenticated users to change their password.
 * Verifies the current password before updating.
 */
export async function changePasswordAction(
  _prevState: ChangePasswordResult | undefined,
  formData: FormData
): Promise<ChangePasswordResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(
      "UNAUTHORIZED",
      "You must be logged in to change your password."
    );
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  };

  const validation = changePasswordSchema.safeParse(rawData);

  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message ?? "Invalid input";
    return err("VALIDATION", firstError);
  }

  const { currentPassword, newPassword } = validation.data;

  try {
    // Verify current password by attempting sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email ?? "",
      password: currentPassword,
    });

    if (signInError) {
      return err("WRONG_PASSWORD", "Current password is incorrect.");
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      log.error(
        {
          userId: user.id,
          action: "change-password",
          error: updateError.message,
        },
        "Password update failed"
      );
      return err("SERVER", "Failed to update password. Please try again.");
    }

    log.info(
      { userId: user.id, action: "change-password" },
      "Password changed successfully"
    );

    return ok({ success: true });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "change-password",
      },
      "Change password server error"
    );
    return err("SERVER", "An unexpected error occurred.");
  }
}
```

**Step 3: Run type check**

Run: `pnpm run typecheck`
Expected: PASS — no type errors

**Step 4: Commit**

```bash
git add src/app/(app)/settings/actions.ts
git commit -m "feat(settings): add changePasswordAction server action (GH-994)"
```

---

### Task 2: Unit Tests for changePasswordAction

**Files:**

- Create: `src/app/(app)/settings/change-password-action.test.ts`

**Step 1: Write the test file**

Follow the exact mock pattern from `delete-account-action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { changePasswordAction } from "./actions";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        signInWithPassword: mockSignInWithPassword,
        updateUser: mockUpdateUser,
      },
    })
  ),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- Helpers ---

function makeFormData(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): FormData {
  const fd = new FormData();
  fd.set("currentPassword", currentPassword);
  fd.set("newPassword", newPassword);
  fd.set("confirmNewPassword", confirmNewPassword);
  return fd;
}

// --- Tests ---

describe("changePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("returns UNAUTHORIZED when not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await changePasswordAction(
      undefined,
      makeFormData("old", "NewPass123", "NewPass123")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("returns VALIDATION when new password is too short", async () => {
    const result = await changePasswordAction(
      undefined,
      makeFormData("old", "short", "short")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("returns VALIDATION when passwords do not match", async () => {
    const result = await changePasswordAction(
      undefined,
      makeFormData("old", "NewPassword1", "DifferentPassword")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("returns WRONG_PASSWORD when current password is incorrect", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const result = await changePasswordAction(
      undefined,
      makeFormData("wrong", "NewPassword1", "NewPassword1")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WRONG_PASSWORD");
    }
  });

  it("returns SERVER when updateUser fails", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: "Auth service error" },
    });

    const result = await changePasswordAction(
      undefined,
      makeFormData("correct", "NewPassword1", "NewPassword1")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
    }
  });

  it("returns success when password is changed", async () => {
    const result = await changePasswordAction(
      undefined,
      makeFormData("correct", "NewPassword1", "NewPassword1")
    );

    expect(result).toEqual({ ok: true, value: { success: true } });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "correct",
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "NewPassword1" });
  });
});
```

**Step 2: Run test to verify all pass**

Run: `pnpm vitest run src/app/\(app\)/settings/change-password-action.test.ts`
Expected: 6 tests PASS

**Step 3: Commit**

```bash
git add src/app/(app)/settings/change-password-action.test.ts
git commit -m "test(settings): add unit tests for changePasswordAction"
```

---

### Task 3: ChangePasswordSection Client Component

**Files:**

- Create: `src/app/(app)/settings/change-password-section.tsx`

**Step 1: Write the component**

Follow the patterns from `profile-form.tsx` (useActionState, SaveCancelButtons, flash messages):

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { useActionState } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SaveCancelButtons } from "~/components/save-cancel-buttons";
import { changePasswordAction, type ChangePasswordResult } from "./actions";
import { cn } from "~/lib/utils";

export function ChangePasswordSection(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    ChangePasswordResult | undefined,
    FormData
  >(changePasswordAction, undefined);

  const [showFeedback, setShowFeedback] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state) {
      setShowFeedback(true);
    }
  }, [state]);

  return (
    <form
      key={resetKey}
      action={formAction}
      className="space-y-6"
      data-testid="change-password-form"
    >
      {state && !state.ok && showFeedback && (
        <div
          className={cn(
            "rounded-md border p-4 border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      <div className="space-y-4 max-w-[320px]">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
          <Input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
          />
        </div>
      </div>

      <div className="pt-2">
        <SaveCancelButtons
          isPending={isPending}
          isSuccess={!!state?.ok && showFeedback}
          onCancel={() => {
            setResetKey((k) => k + 1);
            setShowFeedback(false);
          }}
          saveLabel="Change Password"
        />
      </div>
    </form>
  );
}
```

**Step 2: Run type check**

Run: `pnpm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(app)/settings/change-password-section.tsx
git commit -m "feat(settings): add ChangePasswordSection component (GH-994)"
```

---

### Task 4: Wire Into Settings Page

**Files:**

- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Add import**

Add after the existing imports:

```ts
import { ChangePasswordSection } from "./change-password-section";
```

**Step 2: Add section between Notification Preferences and Danger Zone**

Insert a new section after the Notification Preferences `</div>` and before the Danger Zone `<Separator />`. The new block goes between lines 126-128 (after notifications closing `</div>`, before the `<Separator />`):

```tsx
        <Separator />

        <div>
          <h2 className="text-xl font-semibold mb-4">Security</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Change your account password.
          </p>
          <ChangePasswordSection />
        </div>
```

**Step 3: Run type check and dev server smoke test**

Run: `pnpm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat(settings): wire ChangePasswordSection into settings page (GH-994)"
```

---

### Task 5: Unit Test for ChangePasswordSection Component

**Files:**

- Create: `src/app/(app)/settings/change-password-section.test.tsx`

**Step 1: Write the component test**

Follow the pattern from `profile-form.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChangePasswordSection } from "./change-password-section";
import * as actions from "./actions";

const changePasswordSpy = vi.spyOn(actions, "changePasswordAction");

describe("ChangePasswordSection", () => {
  it("renders all three password fields", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByLabelText("Current Password")).toBeVisible();
    expect(screen.getByLabelText("New Password")).toBeVisible();
    expect(screen.getByLabelText("Confirm New Password")).toBeVisible();
  });

  it("renders the Change Password button", () => {
    render(<ChangePasswordSection />);
    expect(
      screen.getByRole("button", { name: "Change Password" })
    ).toBeVisible();
  });

  it("has correct autocomplete attributes", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByLabelText("Current Password")).toHaveAttribute(
      "autocomplete",
      "current-password"
    );
    expect(screen.getByLabelText("New Password")).toHaveAttribute(
      "autocomplete",
      "new-password"
    );
  });
});
```

**Step 2: Run test**

Run: `pnpm vitest run src/app/\(app\)/settings/change-password-section.test.tsx`
Expected: 3 tests PASS

**Step 3: Commit**

```bash
git add src/app/(app)/settings/change-password-section.test.tsx
git commit -m "test(settings): add unit tests for ChangePasswordSection"
```

---

### Task 6: E2E Test — Change Password Flow

**Files:**

- Create: `e2e/full/change-password.spec.ts`

**Step 1: Write the E2E test**

Uses `loginAs` helper and the seeded test user (`member@test.com` / `TestPassword123`):

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";

test.describe("Change Password", () => {
  test("user can change password from settings page", async ({
    page,
  }, testInfo) => {
    const originalPassword = "TestPassword123";
    const newPassword = "NewTestPassword456";

    // Login with original password
    await loginAs(page, testInfo, {
      email: "member@test.com",
      password: originalPassword,
    });

    // Navigate to settings
    await page.goto("/settings");

    // Verify the Security section is visible
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();

    // Fill in change password form
    const form = page.getByTestId("change-password-form");
    await form.getByLabel("Current Password").fill(originalPassword);
    await form.getByLabel("New Password").fill(newPassword);
    await form.getByLabel("Confirm New Password").fill(newPassword);

    // Submit
    await form.getByRole("button", { name: "Change Password" }).click();

    // Should show success (Saved! button state)
    await expect(form.getByRole("button", { name: "Saved!" })).toBeVisible();

    // --- Verify new password works ---

    // Logout
    await page.getByTestId("user-menu-button").click();
    await page.getByRole("menuitem", { name: /log out/i }).click();

    // Login with new password
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // --- Restore original password (cleanup) ---

    await page.goto("/settings");
    const formAgain = page.getByTestId("change-password-form");
    await formAgain.getByLabel("Current Password").fill(newPassword);
    await formAgain.getByLabel("New Password").fill(originalPassword);
    await formAgain.getByLabel("Confirm New Password").fill(originalPassword);
    await formAgain.getByRole("button", { name: "Change Password" }).click();

    await expect(
      formAgain.getByRole("button", { name: "Saved!" })
    ).toBeVisible();
  });

  test("shows error for wrong current password", async ({ page }, testInfo) => {
    await loginAs(page, testInfo);

    await page.goto("/settings");

    const form = page.getByTestId("change-password-form");
    await form.getByLabel("Current Password").fill("WrongPassword");
    await form.getByLabel("New Password").fill("NewPassword123");
    await form.getByLabel("Confirm New Password").fill("NewPassword123");
    await form.getByRole("button", { name: "Change Password" }).click();

    // Should show error message
    await expect(form.getByText("Current password is incorrect")).toBeVisible();
  });
});
```

**Step 2: Run the E2E test**

Run: `pnpm exec playwright test e2e/full/change-password.spec.ts --project=Desktop`
Expected: 2 tests PASS

**Step 3: Commit**

```bash
git add e2e/full/change-password.spec.ts
git commit -m "test(e2e): add E2E tests for change password flow (GH-994)"
```

---

### Task 7: Preflight + Final Commit

**Step 1: Run preflight**

Run: `pnpm run preflight`
Expected: All checks pass (types, lint, format, unit tests, build)

**Step 2: Fix any issues found by preflight**

If lint/format issues arise, fix and re-run.

**Step 3: Run E2E suite**

Run: `pnpm run e2e:full`
Expected: All E2E tests pass (including new change-password tests)

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address preflight issues for change password feature"
```
