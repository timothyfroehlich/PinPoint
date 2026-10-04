/**
 * Smoke: apron card stress fixtures (PP-xeki, PP-s3fa)
 *
 * Class D (layout / overflow). /dev/apron-cards renders every stress fixture
 * at every apron size and template and runs each card's fit checks in the browser: title
 * width and size, identity panel height, card text at the overflow limit, and
 * that the card's own fit verdict (which gates save and export, spec §3.5 and
 * §6.4) agrees with what the page measured. Real text measurement needs a
 * browser, so this spec is the one owner of those checks. Known issues and
 * spec-allowed blocks (§6.4) show on the page but do not fail here; a known
 * issue that stops reproducing does.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";

test.use({ storageState: STORAGE_STATE.member });

test("every apron stress fixture fits every apron size and template", async ({
  page,
}) => {
  await page.goto("/dev/apron-cards");
  const cards = page.getByTestId("apron-stress-card");
  await expect(cards.first()).toBeVisible();

  // Each card sets data-stress-status once its fonts load and its checks run.
  await expect(
    page.locator('[data-testid="apron-stress-card"]:not([data-stress-status])')
  ).toHaveCount(0, { timeout: 30_000 });

  const failures = await page
    .locator('[data-testid="apron-stress-card"][data-stress-status="fail"]')
    .evaluateAll((failed) =>
      failed.map(
        (card) =>
          `${card.getAttribute("data-fixture")} @ ${card.getAttribute("data-size")} ${card.getAttribute("data-template")}: ${card.querySelector("figcaption")?.textContent ?? ""}`
      )
    );
  expect(failures).toEqual([]);
});
