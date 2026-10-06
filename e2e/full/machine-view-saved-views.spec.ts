import type { Page } from "@playwright/test";
import { test, expect } from "../support/fixtures.js";
import { loginAs } from "../support/actions.js";
import { createTestUser, deleteTestUser } from "../support/supabase-admin.js";
import { getTestEmail } from "../support/test-isolation.js";

/**
 * The one journey only a browser covers: a Default View is applied by a
 * server redirect when the Machines page opens without view configuration
 * (list-views.md §10.10–§10.12). Persistence, which Surfaces open the default,
 * and URL resolution are covered in src/test/integration/saved-views.test.ts
 * and src/lib/machines/view/saved-views.test.ts. A fresh account keeps each
 * browser project's default from colliding with another's.
 *
 * Desktop shows the views as tabs in a "Saved views" navigation landmark,
 * with Save view once the configuration has left every view (§5.2); phones
 * show the Applied View, or "Views" when there is none, as a button that
 * opens the Saved Views sheet (§7.3, §7.6).
 */

interface ViewsUi {
  /** Assert the Applied View, and whether it is edited. */
  expectApplied: (name: string, edited?: boolean) => Promise<void>;
  /** Assert that no view is applied, so Save view is offered. */
  expectNoneApplied: () => Promise<void>;
  /** Open the Save view dialog while no view is applied. */
  openSaveView: () => Promise<void>;
  /** Apply a Built-in View while `from` is the Applied View. */
  applyBuiltIn: (name: string, from: string) => Promise<void>;
}

function desktopViews(page: Page): ViewsUi {
  const nav = page.getByRole("navigation", { name: "Saved views" });
  // An edited tab reads "<name> · Edited"; the dot is hidden from the name.
  const tab = (name: string) =>
    nav.getByRole("link", { name: new RegExp(`^${name}\\s*(Edited)?$`) });
  return {
    async expectApplied(name, edited = false) {
      await expect(tab(name)).toHaveAttribute("aria-current", "page");
      const discard = nav.getByRole("button", { name: "Discard changes" });
      if (edited) {
        await expect(tab(name)).toContainText("Edited");
        await expect(discard).toBeVisible();
      } else {
        await expect(tab(name)).not.toContainText("Edited");
        await expect(discard).toBeHidden();
      }
    },
    async expectNoneApplied() {
      await expect(
        nav.getByRole("button", { name: "Save view" })
      ).toBeVisible();
      // No tab is current.
      for (const link of await nav.getByRole("link").all()) {
        await expect(link).not.toHaveAttribute("aria-current", "page");
      }
    },
    async openSaveView() {
      await nav.getByRole("button", { name: "Save view" }).click();
    },
    async applyBuiltIn(name) {
      await tab(name).click();
    },
  };
}

function phoneViews(page: Page): ViewsUi {
  const sheet = page.getByRole("dialog", { name: "Saved views" });
  // The Applied View button announces an edited view as "<name>, edited";
  // the flex layout may put a space before the comma.
  const appliedButton = (name: string, edited: boolean) =>
    page.getByRole("button", {
      name: new RegExp(`^${name}${edited ? ", edited" : ""}$`),
    });
  return {
    async expectApplied(name, edited = false) {
      await expect(appliedButton(name, edited)).toBeVisible();
    },
    async expectNoneApplied() {
      await expect(appliedButton("Views", false)).toBeVisible();
    },
    async openSaveView() {
      await appliedButton("Views", false).click();
      await expect(sheet).toBeVisible();
      await sheet.getByRole("button", { name: "Save view" }).click();
    },
    async applyBuiltIn(name, from) {
      await appliedButton(from, false).click();
      await expect(sheet).toBeVisible();
      await sheet.getByRole("link", { name, exact: true }).click();
      await expect(sheet).toBeHidden();
    },
  };
}

test.describe("Machine View saved views", () => {
  let userId: string;
  let email: string;
  const password = "TestPassword123";

  test.beforeAll(async () => {
    email = getTestEmail(`saved_views_${Date.now()}@example.com`);
    const user = await createTestUser(email, password);
    userId = user.id;
  });

  test.afterAll(async () => {
    await deleteTestUser(userId);
  });

  test("a default view opens on a bare URL and Built-in Views stay reachable", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, { email, password });
    const views = testInfo.project.name.includes("Mobile")
      ? phoneViews(page)
      : desktopViews(page);

    // Filters that match no Built-in View leave no Applied View (§1, §5.2).
    await page.goto("/m?status=unplayable");
    await views.expectNoneApplied();

    await views.openSaveView();
    const dialog = page.getByRole("dialog", { name: "Save view" });
    await dialog.getByRole("textbox", { name: /Name/ }).fill("Unplayable only");
    await dialog.getByLabel("Open this view by default").check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/[?&]view=[0-9a-f-]{36}/);
    await views.expectApplied("Unplayable only");

    // A bare URL opens the default at its canonical URL (§10.10, §10.11).
    await page.goto("/m");
    await expect(page).toHaveURL(/status=unplayable/);
    await expect(page).toHaveURL(/[?&]view=[0-9a-f-]{36}/);
    await views.expectApplied("Unplayable only");

    // Built-in Views stay reachable despite the default (§10.12).
    await views.applyBuiltIn("On the floor", "Unplayable only");
    await expect(page).toHaveURL(/[?&]view=on-the-floor$/);
    await views.expectApplied("On the floor");

    await page.reload();
    await expect(page).toHaveURL(/[?&]view=on-the-floor$/);
    await views.expectApplied("On the floor");
  });
});
