/**
 * E2E: Machine Info tab — the QR-scanning player's landing (PP-5sgt.2).
 *
 * Covers the player-facing hero: derived status, the prominent "Report a
 * problem" button (and that it routes to the report page), the known-issues
 * peek, and the "View all on Service" link. Owner/Tags/PinballMap reference
 * cards are covered by RTL (info-rail.test.tsx); inline editing lives in
 * machine-details-extended.spec.ts.
 */

import { test, expect } from "../support/fixtures.js";
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

  // Companion to public-routes-audit.spec.ts's anonymous-viewer case. A member
  // who does not own this machine may open Manage for the read-only Pinball Map
  // control, but none of its machine-mutation surfaces (PP-o355.38, spec 4.9).
  test("a member without edit permission gets read-only Pinball Map access on Manage", async ({
    page,
  }) => {
    const readOnlyInitials = seededMachines.medievalMadness.initials;
    await page.goto(`/m/${readOnlyInitials}/edit`);

    await expect(page).toHaveURL(`/m/${readOnlyInitials}/edit`);
    await expect(page.getByTestId("machine-tab-edit")).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByTestId("pbm-listing-control")).toBeVisible();
    await expect(page.getByTestId("pbm-listing-status")).toBeVisible();

    for (const position of ["on", "off", "no_sync"]) {
      await expect(
        page.getByTestId(`pbm-listing-intent-${position}`)
      ).toBeDisabled();
    }
    await expect(page.getByTestId("pbm-listing-refresh")).toBeVisible();
    await expect(page.getByTestId("pbm-listing-add")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Add it on Pinball Map" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Remove it on Pinball Map" })
    ).toHaveCount(0);

    // The same route still withholds every machine-editing surface.
    await expect(
      page.getByRole("button", { name: "Save details" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Danger zone" })
    ).toHaveCount(0);
  });
});
