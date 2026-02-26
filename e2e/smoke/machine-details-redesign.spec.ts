/**
 * E2E Tests: Machine Details Redesign
 *
 * Tests the redesigned machine details page with inline editing,
 * always-visible issues section, and owner requirements callout.
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn, logout, loginAs } from "../support/actions";
import { seededMachines, TEST_USERS } from "../support/constants";

test.describe("Machine Details Redesign", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo);
  });

  test("should display full-width details card with two-column layout", async ({
    page,
  }) => {
    // Navigate to a machine that admin owns (Medieval Madness)
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Machine name heading should render on the detail page
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 })
    ).toContainText(seededMachines.medievalMadness.name);

    // Issues section should be visible in the left column
    await expect(page.getByTestId("issues-section")).toBeVisible();
  });

  test("should show description field for owner", async ({
    page,
  }, testInfo) => {
    // Login as admin (owner of Medieval Madness)
    await logout(page);
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Description field should be present for machine owner
    const descField = page.getByTestId("machine-description");
    await expect(descField).toBeVisible();

    // Restore member login
    await logout(page);
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
  });

  test("should allow owner to inline-edit description", async ({
    page,
  }, testInfo) => {
    // Login as member (owner of Slick Chick)
    // member owns SC, EBD, AFM per seed data
    await page.goto(`/m/${seededMachines.slickChick.initials}`);

    // Click the description field to enter edit mode
    const descDisplay = page.getByTestId("machine-description-display");
    await descDisplay.click();

    // Textarea should appear
    const textarea = page.getByTestId("machine-description-textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeFocused();

    // Type a description
    await textarea.fill("A classic 1963 Gottlieb single-player game");

    // Click Save
    await page.getByTestId("machine-description-save").click();

    // The saved text should be displayed
    await expect(page.getByTestId("machine-description-display")).toContainText(
      "A classic 1963 Gottlieb single-player game"
    );
  });

  test("should allow owner to cancel inline editing", async ({ page }) => {
    await page.goto(`/m/${seededMachines.slickChick.initials}`);

    // Click the description field to enter edit mode
    const descDisplay = page.getByTestId("machine-description-display");
    await descDisplay.click();

    // Textarea should appear
    const textarea = page.getByTestId("machine-description-textarea");
    await expect(textarea).toBeVisible();

    // Type something
    await textarea.fill("This should be cancelled");

    // Click Cancel
    await page.getByTestId("machine-description-cancel").click();

    // Should revert to the previous value (not the cancelled text)
    await expect(
      page.getByTestId("machine-description-display")
    ).not.toContainText("This should be cancelled");
  });

  test("should hide owner notes from non-owners", async ({ page }) => {
    // Default login is member, navigate to admin-owned machine
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Owner notes should NOT be visible (member is not owner)
    await expect(page.getByTestId("machine-owner-notes")).not.toBeVisible();
  });

  test("should show owner notes to machine owner", async ({
    page,
  }, testInfo) => {
    // Login as admin (owns Medieval Madness)
    await logout(page);
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Owner notes should be visible with placeholder
    await expect(page.getByTestId("machine-owner-notes")).toBeVisible();
    await expect(page.getByTestId("machine-owner-notes")).toContainText(
      "Add private notes"
    );

    // Restore member login
    await logout(page);
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
  });

  test("should hide owner requirements from unauthenticated users", async ({
    page,
  }) => {
    // Logout to become unauthenticated
    await logout(page);

    // Navigate to a machine (public route)
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Owner requirements should NOT be visible
    await expect(
      page.getByTestId("machine-owner-requirements")
    ).not.toBeVisible();
  });

  test("should show Report Issue button in header", async ({ page }) => {
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    const reportButton = page
      .getByRole("link", { name: "Report Issue" })
      .and(
        page.locator(
          `a[href="/report?machine=${seededMachines.medievalMadness.initials}"]`
        )
      );
    await expect(reportButton).toBeVisible();
  });

  test("should display owner requirements callout on issue page", async ({
    page,
  }, testInfo) => {
    // First, let's login as admin and set owner requirements on a machine
    await logout(page);
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // Navigate to admin-owned machine
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Click to edit owner requirements
    const reqDisplay = page.getByTestId("machine-owner-requirements-display");
    await reqDisplay.click();

    // Fill in requirements
    const textarea = page.getByTestId("machine-owner-requirements-textarea");
    await textarea.fill("Please handle with care - vintage machine");

    // Save
    await page.getByTestId("machine-owner-requirements-save").click();

    // Verify it saved
    await expect(
      page.getByTestId("machine-owner-requirements-display")
    ).toContainText("Please handle with care - vintage machine");

    // Now navigate to an issue for this machine to check the callout
    // Medieval Madness has seeded issues - navigate to first one
    // Click the first issue card
    const firstIssueCard = page.getByTestId("issue-card").first();
    await firstIssueCard.click();

    // Wait for issue detail page
    await page.waitForLoadState("networkidle");

    // Owner requirements callout should be visible
    const callout = page.getByTestId("owner-requirements-callout");
    await expect(callout).toBeVisible();
    await expect(callout).toContainText(
      "Please handle with care - vintage machine"
    );

    // Restore member login
    await logout(page);
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
  });

  test("non-owner member should not be able to edit admin-owned machine fields", async ({
    page,
  }) => {
    // Default login is member, navigate to admin-owned machine
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Description is visible to non-owner but should not enter edit mode
    await expect(page.getByTestId("machine-description")).toBeVisible();
    await page.getByTestId("machine-description-display").click();
    await expect(
      page.getByTestId("machine-description-textarea")
    ).not.toBeVisible();
  });

  test("member should be able to edit their own machine fields", async ({
    page,
  }) => {
    // Member owns Slick Chick (SC)
    await page.goto(`/m/${seededMachines.slickChick.initials}`);

    // Tournament notes field should be visible. Do not assert placeholder text:
    // this suite runs Chromium and Mobile Chrome against the same DB and prior
    // tests may have already populated notes.
    const tourney = page.getByTestId("machine-tournament-notes");
    await expect(tourney).toBeVisible();

    // Click to edit
    await page.getByTestId("machine-tournament-notes-display").click();

    // Fill in
    const textarea = page.getByTestId("machine-tournament-notes-textarea");
    const tournamentNotes = `Extra ball settings: OFF (${Date.now()})`;
    await textarea.fill(tournamentNotes);

    // Save
    await page.getByTestId("machine-tournament-notes-save").click();

    // Verify
    await expect(
      page.getByTestId("machine-tournament-notes-display")
    ).toContainText(tournamentNotes);
  });
});
