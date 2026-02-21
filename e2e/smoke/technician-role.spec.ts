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
      page.getByRole("heading", { name: "Technician Test Machine" })
    ).toBeVisible();
  });

  test("Technician can edit a machine they do not own", async ({ page }) => {
    // Navigate to a machine owned by admin (Addams Family initials are TAF in seed)
    await page.goto("/m/TAF");

    // Edit button should be visible
    const editButton = page.getByTestId("edit-machine-button");
    await expect(editButton).toBeVisible();

    await editButton.click();

    // Should be able to change the name
    const nameInput = page.getByLabel("Machine Name");
    await nameInput.fill("TAF Technician Edit");

    await page.getByRole("button", { name: "Update Machine" }).click();

    // Verify change persisted
    await expect(
      page.getByRole("heading", { name: "TAF Technician Edit" })
    ).toBeVisible();
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
