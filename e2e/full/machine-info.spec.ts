/**
 * E2E: Machine Info tab — the QR-scanning player's landing (PP-5sgt.2).
 *
 * Covers the player-facing hero: derived status, the prominent "Report a
 * problem" button (and that it routes to the report page), the known-issues
 * peek, and the "View all on Service" link. Owner/Tags/PinballMap reference
 * cards are covered by RTL (info-rail.test.tsx); inline editing lives in
 * machine-details-extended.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import { seededMachines } from "../support/constants.js";

const initials = seededMachines.addamsFamily.initials; // TAF — 2 open major issues

test.describe("Machine Info tab — player landing", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("hero shows status, Report button, and the known-issues peek", async ({
    page,
  }) => {
    await page.goto(`/m/${initials}`);

    const hero = page.getByTestId("machine-info-hero");
    await expect(hero).toBeVisible();

    // Derived status (two major open issues → Needs Service).
    await expect(page.getByTestId("machine-info-hero-status")).toHaveText(
      /needs service/i
    );

    // Known-issues peek lists the seeded open issues.
    await expect(hero.getByText(`${initials}-01`)).toBeVisible();
    await expect(hero.getByText(`${initials}-02`)).toBeVisible();

    // "View all on Service" deep-links to the Service (maintenance) tab.
    await expect(
      hero.getByRole("link", { name: /view all on service/i })
    ).toHaveAttribute("href", `/m/${initials}/maintenance`);
  });

  test("Report a problem routes to the report page for this machine", async ({
    page,
  }) => {
    await page.goto(`/m/${initials}`);

    const report = page.getByTestId("machine-info-report-link");
    await expect(report).toHaveAttribute("href", `/report?machine=${initials}`);

    await report.click();
    await page.waitForURL(new RegExp(`/report\\?machine=${initials}`));
    await expect(
      page.getByRole("heading", { name: /report/i }).first()
    ).toBeVisible();
  });
});
