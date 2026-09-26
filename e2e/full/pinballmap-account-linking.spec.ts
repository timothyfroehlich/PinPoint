/**
 * E2E: a member links and unlinks their Pinball Map account from Settings
 * (pinballmap spec 8.4, PP-o355.6).
 *
 * What only this layer sees: the whole round trip through the real server
 * actions, the real Vault write and decrypt on the local stack, and the
 * revalidated settings row. Pinball Map itself is the mock client at the seam
 * (CORE-TEST-006); its fixed login "wrong" password is the rejected sign-in.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { TEST_USERS } from "../support/constants.js";
import {
  deletePinballMapLink,
  getProfileIdByEmail,
} from "../support/supabase-admin.js";

test.describe("Pinball Map account linking (spec 8.4)", () => {
  test.use({ storageState: STORAGE_STATE.technician });

  test("links after a rejected sign-in, then unlinks", async ({ page }) => {
    const userId = await getProfileIdByEmail(TEST_USERS.technician.email);
    await deletePinballMapLink(userId);

    try {
      await page.goto("/settings");
      const row = page.getByTestId("pinballmap-account-row");
      await expect(row).toContainText("Not linked");

      await row.getByRole("button", { name: "Link Pinball Map" }).click();
      const dialog = page.getByRole("dialog", { name: "Link Pinball Map" });
      await dialog.getByLabel("Username or email").fill("e2e-member");
      await dialog.getByLabel("Password", { exact: true }).fill("wrong");
      await dialog.getByRole("button", { name: "Link account" }).click();

      await expect(dialog.getByTestId("pinballmap-link-error")).toHaveText(
        "Incorrect password"
      );
      // The login survives the failed attempt; only the password is retyped.
      await expect(dialog.getByLabel("Username or email")).toHaveValue(
        "e2e-member"
      );

      await dialog.getByLabel("Password", { exact: true }).fill("pw");
      await dialog.getByRole("button", { name: "Link account" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId("pinballmap-account-status")).toHaveText(
        "Linked as e2e-member"
      );

      await row.getByRole("button", { name: "Unlink" }).click();
      const confirm = page.getByRole("alertdialog", {
        name: "Unlink Pinball Map?",
      });
      await expect(confirm).toContainText("no way to revoke a token");
      await confirm.getByRole("button", { name: "Unlink" }).click();
      await expect(page.getByTestId("pinballmap-account-status")).toHaveText(
        "Not linked"
      );
    } finally {
      await deletePinballMapLink(userId);
    }
  });
});
