/**
 * E2E Tests: Technician Role Permissions
 *
 * Verifies that the technician role has the correct permissions:
 * - Can create machines
 * - Can edit any machine
 * - CANNOT access admin panel
 */

import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions";
import { TEST_USERS } from "../support/constants";

test.describe("Technician Role Permissions", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.technician.email,
      password: TEST_USERS.technician.password,
    });
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test("Technician can see Add Machine button on list page", async ({
    page,
  }) => {
    await page.goto("/m");
    await expect(page.getByTestId("add-machine-button")).toBeVisible();
    await page.getByTestId("add-machine-button").click();
    await expect(page).toHaveURL(/\/m\/new/);
  });

  test("Technician can access machine creation page", async ({ page }) => {
    await page.goto("/m/new");
    await expect(page).toHaveURL(/\/m\/new/);
    await expect(
      page.getByRole("heading", { name: "Add New Machine" })
    ).toBeVisible();
    await expect(page.getByLabel("Machine Name")).toBeVisible();

    // Verify owner selection is visible for technicians
    await expect(page.getByText("Machine Owner")).toBeVisible();
  });

  test("Technician can create a machine", async ({ page }) => {
    const initials = `TC${Math.floor(1000 + Math.random() * 8999)}`;
    await page.goto("/m/new");

    await page.getByLabel("Machine Name").fill("Technician Test Machine");
    await page.getByLabel("Initials").fill(initials);

    // Should be able to select an owner
    await page.getByRole("combobox").click();
    await page.getByLabel("Admin User").click();

    await page.getByRole("button", { name: "Create Machine" }).click();

    // Should redirect to machine detail page
    await expect(page).toHaveURL(new RegExp(`/m/${initials}`));
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 })
    ).toContainText("Technician Test Machine");
  });

  test("Technician can edit a machine they do not own", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("Mobile"),
      "Mobile header currently omits compact edit controls; desktop project covers technician edit permissions."
    );

    // Navigate to a machine owned by admin (Addams Family initials are TAF in seed)
    await page.goto("/m/TAF");

    // Edit button should be visible
    const editButton = page.getByTitle("Edit Machine");
    await expect(editButton).toBeVisible();

    await editButton.click();

    // Edit dialog should open and allow submit
    const dialogHeading = page.getByRole("heading", { name: "Edit Machine" });
    await expect(dialogHeading).toBeVisible();

    await page.getByRole("button", { name: "Update Machine" }).click();

    // Verify dialog closes after successful submit
    await expect(dialogHeading).toBeHidden();
  });

  test("Technician CANNOT access the admin panel", async ({ page }) => {
    await page.goto("/admin/users");

    // Should show Forbidden page
    await expect(page.getByText("Access Denied")).toBeVisible();
    await expect(
      page.locator("span").filter({ hasText: "Technician" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  });
});
