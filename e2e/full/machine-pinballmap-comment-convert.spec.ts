/**
 * E2E: an imported Pinball Map comment on a shared entry is converted to an
 * issue from one cabinet's timeline, and the sibling cabinet's copy then links
 * to that issue (pinballmap spec 7.5, 7.6, 7.8; PP-o355.4).
 *
 * The journey spans three pages — timeline, new issue, sibling timeline — and
 * the client wiring no cheaper layer exercises: the dialog's Radix severity
 * select feeding a native form action, and the redirect to the new issue. The
 * import rules and the at-most-once conversion are integration-tested in
 * `src/test/integration/pinballmap-comment-import.test.ts`.
 *
 * The comment and its copies are seeded directly (`supabase-admin`), never
 * synced, so nothing here reads or edits the shared stored lineup or reaches
 * pinballmap.com (CORE-PBM-001 / CORE-TEST-006).
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { TEST_USERS } from "../support/constants.js";
import { getTestIssueTitle, getTestPrefix } from "../support/test-isolation.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import {
  createTestMachine,
  deletePinballMapComments,
  getProfileIdByEmail,
  seedImportedPinballMapComment,
} from "../support/supabase-admin.js";

test.describe("Pinball Map comment conversion (PP-o355.4)", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("converting from one cabinet links every copy of the comment to the issue", async ({
    page,
    request,
  }) => {
    // Run-scoped id far above Pinball Map's real condition ids, so parallel
    // runs never collide on the primary key.
    const conditionId = 910_000_000 + Math.floor(Math.random() * 80_000_000);
    const title = getTestIssueTitle("Left flipper weak");
    const machineIds: string[] = [];

    try {
      const memberId = await getProfileIdByEmail(TEST_USERS.member.email);
      const first = await createTestMachine(memberId);
      const second = await createTestMachine(memberId);
      machineIds.push(first.id, second.id);
      await seedImportedPinballMapComment({
        conditionId,
        comment: `${title}\nneeds a new coil sleeve`,
        username: "e2e_pbm_user",
        machineIds,
      });

      await page.goto(`/m/${first.initials}/timeline`);
      const row = page.locator('[data-event-kind="pinballmap_comment"]');
      await expect(row).toContainText("e2e_pbm_user");
      await expect(row).toContainText(`also on ${second.initials}`);
      await expect(
        row.getByRole("link", { name: "via Pinball Map" })
      ).toHaveAttribute("href", /by_location_id=26454/);

      await row.getByRole("button", { name: "Convert to issue" }).click();
      const dialog = page.getByRole("dialog", { name: "Convert to issue" });
      await expect(dialog.getByLabel("Title")).toHaveValue(title);
      await dialog.getByTestId("pbm-convert-severity").click();
      await page.getByRole("option", { name: "Major" }).click();
      await dialog.getByRole("button", { name: "Convert to issue" }).click();

      await expect(page).toHaveURL(new RegExp(`/m/${first.initials}/i/1$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        title
      );
      await expect(page.getByText("needs a new coil sleeve")).toBeVisible();

      await page.goto(`/m/${second.initials}/timeline`);
      const siblingRow = page.locator('[data-event-kind="pinballmap_comment"]');
      await expect(
        siblingRow.getByRole("link", {
          name: `Converted to ${first.initials}-01`,
        })
      ).toHaveAttribute("href", `/m/${first.initials}/i/1`);
      await expect(
        siblingRow.getByRole("button", { name: "Convert to issue" })
      ).toHaveCount(0);
    } finally {
      await cleanupTestEntities(request, {
        machineIds,
        issueTitlePrefix: `[${getTestPrefix()}]`,
      });
      await deletePinballMapComments([conditionId]);
    }
  });
});
