/**
 * E2E Full Test: User Invitation and Signup Flow
 *
 * Verifies the complete lifecycle:
 * 1. Admin invites a guest user.
 * 2. User receives invitation email in Mailpit.
 * 3. User follows signup link.
 * 4. User completes signup with a password.
 * 5. User is redirected to dashboard.
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn, logout } from "../support/actions.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import { TEST_USERS } from "../support/constants.js";
import { getSignupLink } from "../support/mailpit.js";

const testEmails = new Set<string>();

test.describe("User Invitation & Signup Flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }, testInfo) => {
    // Login as admin before each test
    await ensureLoggedIn(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });
  });

  test.afterEach(async ({ request }) => {
    if (testEmails.size > 0) {
      await cleanupTestEntities(request, {
        userEmails: Array.from(testEmails),
      });
      testEmails.clear();
    }
  });

  test("should complete the full invite-signup flow", async ({ page }) => {
    test.slow(); // Triple the timeout
    const testId = Math.random().toString(36).substring(7);
    const userEmail = `full-invite-${testId}@example.com`;
    testEmails.add(userEmail);

    console.log(`[test] Starting flow for ${userEmail}`);

    // 1. Navigate to admin users page and invite user

    console.log("[test] Navigating to /admin/users");
    await page.goto("/admin/users");
    console.log("[test] Navigated to /admin/users");

    await page.getByRole("button", { name: /Invite User/i }).click();
    console.log("[test] Clicked Invite User button");

    await page.getByLabel(/First Name/i).fill("Full");
    await page.getByLabel(/Last Name/i).fill("Flow");
    await page.getByRole("textbox", { name: "Email" }).fill(userEmail);

    // Ensure "Send invitation email" is checked
    const inviteSwitch = page.getByRole("switch", {
      name: /Send invitation email/i,
    });
    if ((await inviteSwitch.getAttribute("aria-checked")) === "false") {
      await inviteSwitch.click();
    }

    await page
      .getByRole("button", { name: /Invite User/i, includeHidden: false })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    console.log("[test] Invitation sent");

    // 2. Admin logs out (to clear session for signup)
    await logout(page);

    console.log("[test] Admin logged out");

    // 3. Get signup link from Mailpit
    // Add small delay to allow backend processing time for email transmission.
    // getSignupLink() performs internal polling, but this initial wait helps avoid early empty results.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const signupLink = await getSignupLink(userEmail);
    console.log(`[test] Got signup link: ${signupLink}`);
    expect(signupLink).toContain("/signup");
    expect(signupLink).toContain(encodeURIComponent(userEmail));

    // 4. Follow signup link
    await page.goto(signupLink);

    // Verify signup form is pre-filled
    await expect(page.getByLabel(/Email/i)).toHaveValue(userEmail);
    await expect(page.getByLabel(/First Name/i)).toHaveValue("Full");
    await expect(page.getByLabel(/Last Name/i)).toHaveValue("Flow");

    // 5. Complete signup
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
    await page.getByLabel(/Confirm Password/i).fill("TestPassword123!");
    await page.getByLabel(/terms of service/i).check();
    await page.getByRole("button", { name: /Create Account/i }).click();

    // 6. Verify redirect to dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /Quick Stats/i })
    ).toBeVisible();

    // Verify user profile in menu (mobile or desktop header depending on viewport)
    const userMenu = page
      .locator(
        '[data-testid="user-menu-button"],[data-testid="mobile-user-menu-button"]'
      )
      .filter({ visible: true });
    await expect(userMenu).toBeVisible();
    await userMenu.click();
    await expect(page.getByText("Full Flow")).toBeVisible();
    // Email is no longer displayed in user menu (removed in PR #871)
  });

  test("should transfer machine ownership when invited user signs up", async ({
    page,
  }) => {
    test.slow(); // Triple the timeout - complex multi-step flow
    const testId = Math.random().toString(36).substring(7);
    const userEmail = `owner-invite-${testId}@example.com`;
    testEmails.add(userEmail);

    // 1. Invite user via admin panel
    await page.goto("/admin/users");
    await page.getByRole("button", { name: /Invite User/i }).click();
    await page.getByLabel(/First Name/i).fill("Owner");
    await page.getByLabel(/Last Name/i).fill("Transfer");
    await page.getByRole("textbox", { name: "Email" }).fill(userEmail);

    const inviteSwitch = page.getByRole("switch", {
      name: /Send invitation email/i,
    });
    if ((await inviteSwitch.getAttribute("aria-checked")) === "false") {
      await inviteSwitch.click();
    }

    await page
      .getByRole("button", { name: /Invite User/i, includeHidden: false })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // 2. Assign the invited user as owner of a machine (use Humpty Dumpty - HD)
    await page.goto("/m/HD");
    await expect(
      page.getByRole("heading", { name: /Humpty Dumpty/i })
    ).toBeVisible();

    // Open the Edit Machine dialog (admin has edit permission)
    await page.getByTestId("edit-machine-button").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click the owner dropdown and select the invited user (shown with "(Invited)" suffix)
    const ownerSelect = page.getByTestId("owner-select");
    await ownerSelect.click();
    await page
      .getByRole("option", { name: /Owner Transfer.*\(Invited\)/i })
      .click();

    // Save the machine (dialog closes on success)
    await page.getByRole("button", { name: /Update Machine/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

    // 3. Logout and complete signup
    await logout(page);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const signupLink = await getSignupLink(userEmail);
    await page.goto(signupLink);

    await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
    await page.getByLabel(/Confirm Password/i).fill("TestPassword123!");
    await page.getByLabel(/terms of service/i).check();
    await page.getByRole("button", { name: /Create Account/i }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

    // 4. Verify machine ownership transferred
    await page.goto("/m/HD");
    await expect(
      page.getByRole("heading", { name: /Humpty Dumpty/i })
    ).toBeVisible();

    // The owner display should show the real user name without "(Invited)" suffix
    // Note: User is a member now, so they see the read-only owner display
    const ownerDisplay = page.getByTestId("owner-display");
    await expect(ownerDisplay).toContainText("Owner Transfer");
    // After signup, the user is no longer "invited" - they're a real user
    await expect(ownerDisplay).not.toContainText("(Invited)");
  });
});
