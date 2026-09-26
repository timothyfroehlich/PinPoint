import { test, expect } from "../support/fixtures.js";
import { loginAs } from "../support/actions.js";
import { createTestUser, deleteTestUser } from "../support/supabase-admin.js";
import { getTestEmail } from "../support/test-isolation.js";

/**
 * The one journey only a browser covers: a Default Saved View is applied by a
 * server redirect when the Surface opens without view configuration
 * (machine-views.md §8.11–§8.13). Persistence and URL resolution are covered
 * in src/test/integration/machine-view-saved-views.test.ts and
 * src/lib/machines/view/saved-views.test.ts. A fresh account keeps each
 * browser project's default from colliding with another's.
 */
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

    await page.goto("/m?status=unplayable");
    const trigger = page.getByRole("button", { name: /^Views:/ });
    await expect(trigger).toHaveAccessibleName("Views: On the floor, edited");

    await trigger.click();
    await page.getByText("Save as new…").click();
    const dialog = page.getByRole("dialog", { name: "Save view" });
    await dialog.getByRole("textbox", { name: /Name/ }).fill("Unplayable only");
    await dialog.getByLabel("Open this view by default").check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/[?&]view=[0-9a-f-]{36}/);
    await expect(trigger).toHaveAccessibleName("Views: Unplayable only");

    // A bare URL opens the default at its canonical URL (§8.11, §8.12).
    await page.goto("/m");
    await expect(page).toHaveURL(/status=unplayable/);
    await expect(page).toHaveURL(/[?&]view=[0-9a-f-]{36}/);
    await expect(trigger).toHaveAccessibleName("Views: Unplayable only");

    // Built-in Views stay reachable despite the default (§8.13).
    await trigger.click();
    await page.getByText("On the floor", { exact: true }).click();
    await expect(page).toHaveURL(/[?&]view=on-the-floor$/);
    await expect(trigger).toHaveAccessibleName("Views: On the floor");

    await page.reload();
    await expect(page).toHaveURL(/[?&]view=on-the-floor$/);
    await expect(trigger).toHaveAccessibleName("Views: On the floor");
  });
});
