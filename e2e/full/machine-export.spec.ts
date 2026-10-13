/**
 * E2E: Machine list CSV export (machine-views §3.15–§3.17).
 *
 * Column mapping, scope resolution, and the server action's auth gate are
 * covered in src/test/integration/machine-export-action.test.ts; this spec
 * proves the List Header button downloads the file in a real browser.
 */

import { readFile } from "node:fs/promises";
import { test, expect } from "../support/fixtures.js";
import { seededMachines } from "../support/constants.js";
import { STORAGE_STATE } from "../support/auth-state.js";

const HEADER =
  "ID,Name,Model,Manufacturer,Year,Owner,Date Added,Presence,Playability,Open Issues,Last Serviced,Last Activity";

test.describe("Machine export", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name.includes("Mobile"),
      "Export sits in the desktop List Header (list-views §5.5); the phone header has none (§7.3)"
    );
  });

  test.describe("signed in", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("downloads every matching machine as a CSV", async ({ page }) => {
      await page.goto("/m");
      await expect(
        page.getByRole("link", {
          name: seededMachines.attackFromMars.name,
          exact: true,
        })
      ).toBeVisible();

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export to CSV" }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(
        /^pinpoint-machines-\d{4}-\d{2}-\d{2}\.csv$/
      );
      const path = await download.path();
      const csv = (await readFile(path, "utf8")).replace(/^﻿/, "");
      const lines = csv.split("\r\n");
      expect(lines[0]).toBe(HEADER);
      expect(
        lines.some((line) =>
          line.startsWith(
            `${seededMachines.attackFromMars.initials},${seededMachines.attackFromMars.name},`
          )
        )
      ).toBe(true);
    });
  });

  test("is not offered to anonymous visitors", async ({ page }) => {
    await page.goto("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Export to CSV" })
    ).toHaveCount(0);
  });
});
