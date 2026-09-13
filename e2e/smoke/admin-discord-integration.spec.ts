/**
 * E2E smoke: Combined admin integrations page.
 *
 * Covers the combined admin integrations surface:
 * - The legacy Discord route redirects to the combined page
 * - Page renders Discord first and Pinball Map second with their stored state
 * - No distinct integration enable switch is rendered
 * - Clear confirmation can be inspected and cancelled without mutating state
 * - The combined surface is accessible and has no horizontal overflow
 * - Navigation from the user menu lands on the combined page
 * - Unauthenticated visitors don't see the page heading
 *
 * Server Action behavior and DB write paths stay in the Discord and Pinball Map
 * action integration suites; this route coverage deliberately does not save.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import {
  assertNoA11yViolations,
  assertNoHorizontalOverflow,
} from "../support/actions.js";
import {
  configureDiscordIntegrationForTest,
  unconfigureDiscordIntegrationForTest,
} from "../support/supabase-admin.js";

test.describe("Admin integrations page", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("redirects the legacy route and renders both integration cards", async ({
    page,
  }) => {
    await page.goto("/admin/integrations/discord");
    await expect(page).toHaveURL(/\/admin\/integrations$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Integrations" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Discord" })
    ).toBeVisible();
    const discordCard = page.getByTestId("discord-integration-card");
    // Key form fields from the Pattern B redesign.
    await expect(discordCard.getByLabel("Bot token")).toBeVisible();
    await expect(discordCard.getByLabel("Server ID")).toBeVisible();
    await expect(discordCard.getByLabel("Invite link")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    // Save / Reset footer.
    await expect(
      discordCard.getByRole("button", { name: "Save changes" })
    ).toBeVisible();
    await expect(
      discordCard.getByRole("button", { name: "Reset" })
    ).toBeVisible();

    const pinballMapCard = page.getByTestId("pinballmap-integration-card");
    await expect(
      pinballMapCard.getByRole("heading", { level: 2, name: "Pinball Map" })
    ).toBeVisible();
    await expect(pinballMapCard.getByLabel("Location ID")).toHaveValue("26454");
    await expect(
      pinballMapCard.getByText("Austin Pinball Collective", { exact: true })
    ).toBeVisible();
    await expect(
      pinballMapCard.getByRole("link", { name: "View on Pinball Map" })
    ).toHaveAttribute(
      "href",
      "https://pinballmap.com/map/?by_location_id=26454"
    );
    await expect(
      pinballMapCard.getByRole("heading", { level: 3, name: "Sync health" })
    ).toBeVisible();
    await expect(
      pinballMapCard.getByText(/machines in the snapshot/)
    ).toBeVisible();

    await pinballMapCard.getByLabel("Location ID").fill("");
    await pinballMapCard.getByRole("button", { name: "Save changes" }).click();
    const clearDialog = page.getByRole("alertdialog", {
      name: "Stop tracking Austin Pinball Collective?",
    });
    await expect(clearDialog).toBeVisible();
    await expect(clearDialog).toContainText(
      "Nothing changes on pinballmap.com."
    );
    await clearDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(clearDialog).toHaveCount(0);
    await expect(pinballMapCard.getByLabel("Location ID")).toHaveValue("");

    await assertNoHorizontalOverflow(page);
    await assertNoA11yViolations(page);
  });

  test("navigates here from the user menu", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-admin-integrations").click();
    await expect(page).toHaveURL(/\/admin\/integrations$/);
  });

  test("removes a saved token only after confirmation", async ({ page }) => {
    await configureDiscordIntegrationForTest();
    try {
      await page.goto("/admin/integrations");
      await page.getByRole("button", { name: "Remove saved token" }).click();
      await expect(
        page.getByRole("alertdialog", {
          name: "Remove the Discord bot token?",
        })
      ).toBeVisible();
      await page.getByRole("button", { name: "Remove token" }).click();
      await expect(
        page.getByRole("button", { name: "Remove saved token" })
      ).toHaveCount(0);
    } finally {
      await unconfigureDiscordIntegrationForTest();
    }
  });
});

test.describe("Admin integrations page (unauthenticated)", () => {
  // Explicitly no storageState — fresh anonymous context
  test.use({ storageState: { cookies: [], origins: [] } });

  test("non-admin is forbidden", async ({ page }) => {
    await page.goto("/admin/integrations/discord");
    // Unauthenticated hits login redirect; member would hit Forbidden — either
    // way we're NOT seeing the combined page heading.
    await expect(
      page.getByRole("heading", { level: 1, name: "Integrations" })
    ).toHaveCount(0);
  });
});
