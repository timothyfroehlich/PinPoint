/**
 * Print settings sheets (PP-k3km, docs/feature-specs/settings-sheets.md).
 *
 * What only a browser proves: an anonymous visitor reaches the page from the
 * Machines list's Print menu (§2.1), adds machines from the list (§2.2–§2.3),
 * the print run shows what each block will print and asks for a set when a
 * tag finds several (§2.5, §6.3), Print opens the sheet on its own page and
 * links back to the same run (§2.8), and a tag page opens the page with its
 * machines On the Floor already added (§2.6).
 *
 * The comparison and default-resolution rules are unit-tested
 * (src/lib/machines/settings-sheet*.test.ts) and the loaders at the
 * integration layer (src/test/integration/settings-sheet-queries.test.ts).
 * These tests read the seeded settings sets (supabase/seed-machine-settings.mjs)
 * and never write them.
 */

import type { Page } from "@playwright/test";
import { test, expect } from "../support/fixtures.js";
import { assertNoA11yViolations } from "../support/actions.js";

// The print page opens the print dialog on load; a test has no use for it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.print = (): void => undefined;
  });
});

async function addByInitials(page: Page, initials: string): Promise<void> {
  const search = page.getByRole("searchbox", { name: "Search machines" });
  await search.fill(initials);
  // The machine list renders as a table (role=row) on desktop and as a compact
  // card list (role=listitem, MachineViewCompactList) on phones; the off-
  // breakpoint layout is display:none, so only one is in the accessibility tree
  // at a time. Match either so this helper works at every viewport. Scoped to
  // the "Add machines" section so the mobile listitem branch can't collide with
  // the print-run list's items.
  const section = page.getByRole("region", { name: "Add machines" });
  const hasInitials = { has: page.getByText(initials, { exact: true }) };
  const entry = section
    .getByRole("row")
    .filter(hasInitials)
    .or(section.getByRole("listitem").filter(hasInitials));
  await entry.getByRole("button", { name: /^Add / }).click();
  await expect(entry.getByText("Added")).toBeVisible();
}

function printRunRow(page: Page, name: string) {
  return page
    .getByRole("region", { name: "In this print run" })
    .getByRole("listitem")
    .filter({ hasText: name });
}

test.describe("Print settings sheets", () => {
  test("an anonymous visitor builds a run, previews, prints, and comes back", async ({
    page,
  }) => {
    await page.goto("/m");
    await page.getByRole("button", { name: "Print" }).click();
    await page.getByRole("menuitem", { name: "Settings sheets" }).click();
    await expect(page).toHaveURL(/\/m\/settings-sheets/);
    await expect(
      page.getByRole("heading", { name: "Print settings sheets" })
    ).toBeVisible();

    await addByInitials(page, "MM");
    await addByInitials(page, "GDZ2");

    await expect(printRunRow(page, "Medieval Madness")).toContainText(
      "9 changes"
    );
    await expect(printRunRow(page, "Godzilla")).toContainText(
      "No House set: record values"
    );
    await expect(
      page.getByRole("complementary", { name: "Print run" })
    ).toContainText("2 machines print");
    await assertNoA11yViolations(page);

    await page.getByRole("button", { name: "Preview" }).click();
    const preview = page.getByRole("dialog", { name: "Preview" });
    await expect(
      preview.getByRole("article", { name: "Settings sheet" })
    ).toContainText("No House set — record original values");
    await page.keyboard.press("Escape");

    await page.getByRole("radio", { name: /Set up and restore/ }).check();
    await page
      .getByRole("complementary", { name: "Print run" })
      .getByRole("link", { name: "Print" })
      .click();
    await expect(page).toHaveURL(/\/m\/settings-sheets\/print\?/);
    const sheet = page.getByRole("article", { name: "Settings sheet" });
    await expect(sheet).toContainText("Set up and restore");
    await expect(sheet).toContainText("Castle Difficulty");

    await page.getByRole("link", { name: "Back to print run" }).click();
    await expect(page).toHaveURL(/\/m\/settings-sheets/);
    await expect(printRunRow(page, "Medieval Madness")).toBeVisible();
    await expect(printRunRow(page, "Godzilla")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: /Set up and restore/ })
    ).toBeChecked();

    // Once the list has rewritten the URL, a reload restores the run from
    // this tab's storage.
    await expect(page).not.toHaveURL(/[?&]m=/);
    await page.reload();
    await expect(printRunRow(page, "Medieval Madness")).toContainText(
      "9 changes"
    );
    await expect(printRunRow(page, "Godzilla")).toBeVisible();
  });

  test("a tag default that finds several sets asks which one", async ({
    page,
  }) => {
    await page.goto("/m/settings-sheets");
    await page.getByLabel("to", { exact: true }).selectOption({
      label: "Tag: Bat City 2025",
    });
    await addByInitials(page, "HD");

    const row = printRunRow(page, "Humpty Dumpty");
    await expect(row).toContainText("Choose a set");
    await expect(
      page.getByRole("complementary", { name: "Print run" })
    ).toContainText("0 machines print");

    await row
      .getByRole("combobox", { name: "To set for Humpty Dumpty" })
      .selectOption({ label: "Bat City finals" });
    // Finals records one plug; the other two House plugs differ as unrecorded.
    await expect(row).toContainText("3 changes");

    await page
      .getByRole("complementary", { name: "Print run" })
      .getByRole("link", { name: "Print" })
      .click();
    const sheet = page.getByRole("article", { name: "Settings sheet" });
    await expect(sheet).toContainText("Preferred House to Tag: Bat City 2025");
    await expect(sheet).toContainText("1-ball");
  });

  test("a tag page opens the page with its machines on the floor added", async ({
    page,
  }) => {
    await page.goto("/c/tags/location/front-room");
    await page.getByRole("link", { name: "Print settings sheets" }).click();
    await expect(page).toHaveURL(/\/m\/settings-sheets/);
    const run = page.getByRole("region", { name: "In this print run" });
    // Front room's seeded machines: Attack from Mars and others On the Floor,
    // and Spider-Man, On Loan, which is never added (§2.3).
    await expect(run).toContainText("Attack from Mars");
    await expect(run).not.toContainText("Spider-Man");
  });
});
