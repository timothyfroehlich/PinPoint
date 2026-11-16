/**
 * E2E: Machine list CSV export (machine-views §3.15–§3.17).
 *
 * Column mapping, scope resolution, and the server action's auth gate are
 * covered in src/test/integration/machine-export-action.test.ts; this spec
 * proves Export to CSV in the page's ⋯ downloads the file in a real browser,
 * at every width (list-views §5.5, machine-views §6.6).
 */

import { readFile } from "node:fs/promises";
import { test, expect } from "../support/fixtures.js";
import { seededMachines } from "../support/constants.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import {
  clickPageAction,
  expectNoPageAction,
} from "../support/page-actions.js";

const HEADER =
  "ID,Name,Model,Manufacturer,Year,Owner,Date Added,Presence,Playability,Open Issues,Last Serviced,Last Activity";

test.describe("Machine export", () => {
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
      await clickPageAction(page, "Export to CSV");
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
    // Their ⋯ still holds Print settings sheets (settings-sheets §2.1).
    await expectNoPageAction(page, "Export to CSV");
  });
});
