import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { createTestUser, updateUserRole } from "../support/supabase-admin.js";

/**
 * Informational screenshot capture across all viewports.
 *
 * These tests never assert visual correctness — they only navigate to each page,
 * wait for it to render, and attach a full-page screenshot to the Playwright HTML
 * report. The report is deployed to GitHub Pages per PR.
 */

// Shared admin credentials, set up once for all projects
let adminEmail: string;

test.beforeAll(async () => {
  const timestamp = Date.now();
  adminEmail = `screenshots_admin_${timestamp}@example.com`;
  const adminUser = await createTestUser(adminEmail);
  await updateUserRole(adminUser.id, "admin");
});

// ---------------------------------------------------------------------------
// Public pages (no login required)
// ---------------------------------------------------------------------------

test.describe("Public pages", () => {
  test("landing page", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("landing-page", {
      body: screenshot,
      contentType: "image/png",
    });
  });

  test("machines list", async ({ page }, testInfo) => {
    await page.goto("/m");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("machines-list", {
      body: screenshot,
      contentType: "image/png",
    });
  });

  test("machine detail — TAF", async ({ page }, testInfo) => {
    await page.goto("/m/TAF");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("machine-detail-TAF", {
      body: screenshot,
      contentType: "image/png",
    });
  });

  test("issue detail — TAF issue 1", async ({ page }, testInfo) => {
    await page.goto("/m/TAF/i/1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("issue-detail-TAF-1", {
      body: screenshot,
      contentType: "image/png",
    });
  });

  test("report form", async ({ page }, testInfo) => {
    await page.goto("/report");
    await expect(page.locator("main")).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("report-form", {
      body: screenshot,
      contentType: "image/png",
    });
  });

  test("dashboard", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    await expect(page.locator("main")).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("dashboard", {
      body: screenshot,
      contentType: "image/png",
    });
  });
});

// ---------------------------------------------------------------------------
// Authenticated pages
// ---------------------------------------------------------------------------

test.describe("Authenticated pages", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });
  });

  test("issues list", async ({ page }, testInfo) => {
    await page.goto("/issues");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("issues-list", {
      body: screenshot,
      contentType: "image/png",
    });
  });

  test("settings", async ({ page }, testInfo) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("settings", {
      body: screenshot,
      contentType: "image/png",
    });
  });

  test("admin users", async ({ page }, testInfo) => {
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("admin-users", {
      body: screenshot,
      contentType: "image/png",
    });
  });
});
