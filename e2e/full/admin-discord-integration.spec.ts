import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import {
  createTestUser,
  deleteTestUser,
  updateUserRole,
} from "../support/supabase-admin.js";

test.describe("Admin Discord Integration", () => {
  let adminEmail: string;
  let adminId: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    adminEmail = `admin_discord_${ts}@example.com`;
    const adminUser = await createTestUser(adminEmail);
    adminId = adminUser.id;
    await updateUserRole(adminId, "admin");
  });

  test.afterAll(async () => {
    await deleteTestUser(adminId);
  });

  test("admin can navigate to the Discord integration page via the user menu", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });

    // Open the user menu and click the Integrations link.
    await page.getByTestId("user-menu-button").click();
    const integrationsLink = page.getByTestId("user-menu-admin-integrations");
    await expect(integrationsLink).toBeVisible();
    await integrationsLink.click();

    // Should land on the Discord admin page.
    await expect(page).toHaveURL("/admin/integrations/discord", {
      timeout: 10000,
    });
    await expect(
      page.getByRole("heading", { name: "Discord Integration" })
    ).toBeVisible();

    // Form fields should be present.
    await expect(page.getByLabel("Bot token")).toBeVisible();
    await expect(
      page.getByLabel("Guild ID (APC Discord server)")
    ).toBeVisible();
    await expect(page.getByLabel("Invite link")).toBeVisible();

    // The Enabled switch is disabled until a bot token is set — this is the
    // invariant we enforce in the config form.
    const enabledSwitch = page.getByRole("switch", {
      name: /integration enabled/i,
    });
    await expect(enabledSwitch).toBeVisible();
    await expect(enabledSwitch).toBeDisabled();
    await expect(
      page.getByText("Set a bot token above before enabling.")
    ).toBeVisible();
  });

  test("User Management link in the user menu lands on /admin/users", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });

    // Open the user menu and click the (renamed) User Management link.
    await page.getByTestId("user-menu-button").click();
    const userMgmtLink = page.getByTestId("user-menu-admin");
    await expect(userMgmtLink).toBeVisible();
    await expect(userMgmtLink).toHaveText(/user management/i);
    await userMgmtLink.click();

    await expect(page).toHaveURL("/admin/users", { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();
  });
});
