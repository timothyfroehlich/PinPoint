import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import {
  createTestUser,
  updateUserRole,
  createInvitedUser,
} from "../support/supabase-admin.js";

test.describe("Admin Remove Invited User", () => {
  let adminEmail: string;
  let adminId: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    adminEmail = `admin_remove_${ts}@example.com`;
    const adminUser = await createTestUser(adminEmail);
    adminId = adminUser.id;
    await updateUserRole(adminId, "admin");
  });

  test("admin can remove a pending invited user", async ({
    page,
  }, testInfo) => {
    const inviteEmail = `invited_remove_${Date.now()}@example.com`;
    await createInvitedUser(inviteEmail, "Chip", "S");

    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });

    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();

    // The invited user row should be visible
    const row = page.getByRole("row").filter({ hasText: inviteEmail });
    await expect(row).toBeVisible();

    // The Remove button should be present on the invited row
    const removeButton = row.getByRole("button", { name: /remove/i });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // AlertDialog should appear
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Remove invitation?")).toBeVisible();
    await expect(dialog.getByText("Chip S")).toBeVisible();

    // Confirm removal
    await dialog.getByRole("button", { name: "Remove" }).click();

    // Toast success message
    await expect(
      page.getByText("Invitation removed successfully")
    ).toBeVisible();

    // The row should be gone from the table
    await expect(
      page.getByRole("row").filter({ hasText: inviteEmail })
    ).not.toBeVisible();
  });

  test("Remove button is not shown for active users", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });

    await page.goto("/admin/users");

    // The admin's own row (active user) should not have a Remove button
    const row = page.getByRole("row").filter({ hasText: adminEmail });
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("button", { name: /remove/i })
    ).not.toBeVisible();
  });
});
