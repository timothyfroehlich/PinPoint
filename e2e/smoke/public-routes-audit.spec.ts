/**
 * Smoke Test: Public Routes Audit
 *
 * Verifies key user-facing public routes are accessible to unauthenticated
 * users without redirecting to /login. API endpoints and auth callbacks are
 * covered by unit tests in middleware.test.ts rather than E2E.
 *
 * This is the definitive test for the public access audit (PinPoint-kh6).
 * Individual route behavior is tested in other spec files; this file
 * focuses solely on "can an unauthenticated user reach this page?"
 */

import { test, expect } from "@playwright/test";
import { seededMachines, seededIssues } from "../support/constants";

test.describe("Public Routes Audit", () => {
  test.describe("Static public pages", () => {
    test("/ (landing page) loads without login", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL("/");
      await expect(
        page.getByRole("heading", { name: /Welcome to PinPoint/i })
      ).toBeVisible();
    });

    test("/about loads without login", async ({ page }) => {
      await page.goto("/about");
      await expect(page).toHaveURL("/about");
      await expect(
        page.getByRole("heading", { name: "About PinPoint" })
      ).toBeVisible();
    });

    test("/privacy loads without login", async ({ page }) => {
      await page.goto("/privacy");
      await expect(page).toHaveURL("/privacy");
      await expect(
        page.getByRole("heading", { name: "Privacy Policy" })
      ).toBeVisible();
    });

    test("/terms loads without login", async ({ page }) => {
      await page.goto("/terms");
      await expect(page).toHaveURL("/terms");
      await expect(
        page.getByRole("heading", { name: "Terms of Service" })
      ).toBeVisible();
    });

    test("/help loads without login", async ({ page }) => {
      await page.goto("/help");
      await expect(page).toHaveURL("/help");
      await expect(page.getByRole("heading", { name: "Help" })).toBeVisible();
    });

    test("/help/permissions loads without login", async ({ page }) => {
      await page.goto("/help/permissions");
      await expect(page).toHaveURL("/help/permissions");
      await expect(
        page.getByRole("heading", { name: /Roles & Permissions/i })
      ).toBeVisible();
    });

    test("/dashboard loads without login", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL("/dashboard");
      await expect(page.getByTestId("quick-stats")).toBeVisible();
    });
  });

  test.describe("Machine routes (public read access)", () => {
    test("/m (machines list) loads without login", async ({ page }) => {
      await page.goto("/m");
      await expect(page).toHaveURL("/m");
      await expect(
        page.getByRole("heading", { name: "Machines" })
      ).toBeVisible();
    });

    test("/m/[initials] (machine detail) loads without login", async ({
      page,
    }) => {
      const machine = seededMachines.medievalMadness;
      await page.goto(`/m/${machine.initials}`);
      await expect(page).toHaveURL(`/m/${machine.initials}`);
      await expect(
        page.getByRole("heading", { name: machine.name })
      ).toBeVisible();
    });

    test("/m/[initials]/i/[num] (issue detail) loads without login", async ({
      page,
    }) => {
      const issue = seededIssues.AFM[0];
      await page.goto(`/m/AFM/i/${issue.num}`);
      await expect(page).toHaveURL(`/m/AFM/i/${issue.num}`);
      // Issue title should be visible
      await expect(
        page.getByRole("heading", { name: issue.title })
      ).toBeVisible();
    });
  });

  test.describe("Report route (public)", () => {
    test("/report loads without login", async ({ page }) => {
      await page.goto("/report");
      await expect(page).toHaveURL(/\/report/);
      // Report form should be visible
      await expect(
        page.getByRole("heading", { name: /report/i })
      ).toBeVisible();
    });
  });

  test.describe("Auth routes (public by nature)", () => {
    test("/login loads without redirect loop", async ({ page }) => {
      await page.goto("/login");
      await expect(page).toHaveURL("/login");
    });

    test("/signup loads without redirect loop", async ({ page }) => {
      await page.goto("/signup");
      await expect(page).toHaveURL("/signup");
    });
  });

  test.describe("Issues route (public read access)", () => {
    test("/issues loads without login", async ({ page }) => {
      await page.goto("/issues");
      await expect(page).toHaveURL("/issues");
      await expect(
        page.getByRole("heading", { name: "All Issues" })
      ).toBeVisible();
    });
  });

  test.describe("Protected routes redirect to login", () => {
    test("/settings redirects to login", async ({ page }) => {
      await page.goto("/settings");
      await expect(page).toHaveURL(/\/login/);
    });

    test("/admin/users redirects to login", async ({ page }) => {
      await page.goto("/admin/users");
      await expect(page).toHaveURL(/\/login/);
    });

    test("/m/new redirects to login", async ({ page }) => {
      await page.goto("/m/new");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Cross-page navigation without login", () => {
    test("navigating from privacy to help works without login wall", async ({
      page,
    }) => {
      await page.goto("/privacy");
      await expect(page).toHaveURL("/privacy");

      // Navigate directly to help (verifying route is public)
      await page.goto("/help");
      await expect(page).toHaveURL("/help");
      await expect(page.getByRole("heading", { name: "Help" })).toBeVisible();
    });

    test("about page links to privacy and terms without login wall", async ({
      page,
    }) => {
      await page.goto("/about");

      // Click Privacy Policy link
      await page.getByRole("link", { name: "Privacy Policy" }).click();
      await expect(page).toHaveURL("/privacy");

      // Go back and click Terms of Service
      await page.goto("/about");
      await page.getByRole("link", { name: "Terms of Service" }).click();
      await expect(page).toHaveURL("/terms");
    });

    test("machine detail Report Issue button navigates without login wall", async ({
      page,
    }) => {
      const machine = seededMachines.medievalMadness;
      await page.goto(`/m/${machine.initials}`);

      // Click Report Issue button
      await page
        .locator(`a[href="/report?machine=${machine.initials}"]`)
        .click();
      await expect(page).toHaveURL(/\/report/);
    });
  });
});
