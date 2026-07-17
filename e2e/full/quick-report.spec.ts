import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { TEST_USERS, seededMachines } from "../support/constants.js";

/**
 * Quick report — full authoring journey (PP-sn34).
 *
 * The smoke spec proves the page renders + gates access. This one exercises the
 * browser-rendered behaviour that jsdom can't: the real quick-submit round-trip,
 * keyboard quick-submit, focus advancing to the next row, and the container-query
 * reflow that collapses the machine picker to just its initials on a phone width.
 * (Layout/responsive coverage follows the project's behavioural pattern — see
 * responsive-overflow.spec.ts — not pixel-diff screenshots.)
 */

const afm = seededMachines.attackFromMars;
const createdIdPattern = new RegExp(`${afm.initials}-\\d+`);

test.describe("quick report — authoring", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
    await page.goto("/report/quick");
    await expect(page.getByTestId("quick-report-grid")).toBeVisible();
  });

  test("quick-submits a row, links the created issue, and advances focus to a fresh row", async ({
    page,
  }) => {
    const firstRow = page.getByTestId("quick-row").first();
    await firstRow.getByRole("combobox", { name: "Machine" }).click();
    await page.getByTestId(`machine-option-${afm.id}`).click();
    await firstRow
      .getByRole("textbox", { name: /Problem/ })
      .fill("Right flipper weak");
    await firstRow.getByRole("button", { name: /^Submit$/ }).click();

    // The submitted row leaves the draft and becomes a confirmation receipt
    // linking the new issue (no "undo" — the issue is already created).
    await expect(page.getByTestId("quick-receipt")).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: createdIdPattern })
    ).toBeVisible();

    // A single fresh blank editable row remains, and its machine picker takes
    // focus so keyboard authoring can continue (… → next issue).
    await expect(page.getByTestId("quick-row")).toHaveCount(1);
    await expect(page.getByRole("combobox", { name: "Machine" })).toBeFocused();
  });

  test("Enter in the problem field quick-submits the row", async ({ page }) => {
    const firstRow = page.getByTestId("quick-row").first();
    await firstRow.getByRole("combobox", { name: "Machine" }).click();
    await page.getByTestId(`machine-option-${afm.id}`).click();

    const problem = firstRow.getByRole("textbox", { name: /Problem/ });
    await problem.fill("Coil stop broken");
    await problem.press("Enter");

    await expect(
      page.getByRole("link", { name: createdIdPattern })
    ).toBeVisible();
  });

  test("keyboard Tab flows from the machine picker straight to the problem field", async ({
    page,
  }) => {
    const firstRow = page.getByTestId("quick-row").first();
    const machine = firstRow.getByRole("combobox", { name: "Machine" });
    await machine.focus();
    await expect(machine).toBeFocused();

    // Tab lands on Problem (not Severity) — the pre-filled severity/priority
    // fields sit later in tab order so the fast path is machine → problem.
    await page.keyboard.press("Tab");
    await expect(
      firstRow.getByRole("textbox", { name: /Problem/ })
    ).toBeFocused();
  });

  test("collapsed row shows initials-only at a phone width and the full name on desktop", async ({
    page,
  }) => {
    const firstRow = page.getByTestId("quick-row").first();
    await firstRow.getByRole("combobox", { name: "Machine" }).click();
    await page.getByTestId(`machine-option-${afm.id}`).click();

    const initialsOnly = firstRow.getByText(afm.initials, { exact: true });
    const fullName = firstRow.getByText(`${afm.name} (${afm.initials})`);

    // Phone width: the machine trigger collapses to just the initials so it fits
    // on one line alongside severity + priority.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(initialsOnly).toBeVisible();
    await expect(fullName).toBeHidden();

    // Desktop width: it expands back to "Name (INITIALS)".
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(fullName).toBeVisible();
    await expect(initialsOnly).toBeHidden();
  });
});
