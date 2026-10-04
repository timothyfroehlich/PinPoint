/**
 * E2E: Public Machine Access
 *
 * Tests that unauthenticated users can view the machines list,
 * machine detail pages, and interact with summary widgets.
 *
 * Server Action permission enforcement (createMachineAction requires admin/technician;
 * unauthenticated callers rejected) is covered in machine-actions.test.ts.
 * Note: The page UI link gate (`canCreateMachine` at src/app/(app)/m/page.tsx) is a
 * presentational conditional render, while the server action gate is the security boundary.
 */

import { test, expect } from "../support/fixtures.js";
import { seededMachines } from "../support/constants.js";

test.describe("Machines Public Access", () => {
  test("unauthenticated user can view machines list", async ({ page }) => {
    // Do NOT log in - verify anonymous access
    await page.goto("/m");

    // Verify we're on the machines page (no redirect to login)
    await expect(page).toHaveURL(/\/m(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // The public directory presents a table on desktop and a compact list on
    // phones. The machine link is visible in both layouts.
    await expect(
      page.getByRole("link", {
        name: seededMachines.attackFromMars.name,
        exact: true,
      })
    ).toBeVisible();
  });

  test("unauthenticated user can view machine detail page", async ({
    page,
  }) => {
    // Navigate directly to a seeded machine detail page
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Verify we can see the machine detail without login redirect
    await expect(page).toHaveURL(
      `/m/${seededMachines.medievalMadness.initials}`
    );
    await expect(
      page.getByRole("heading", { name: seededMachines.medievalMadness.name })
    ).toBeVisible();

    // After the tabbed-machine-layout PR, issue cards live on the Service tab
    // (`/m/[initials]/maintenance`), not the default Info tab. Navigate there
    // to verify cards render for unauthenticated users.
    await page.goto(
      `/m/${seededMachines.medievalMadness.initials}/maintenance`
    );
    const issueCards = page.getByTestId("issue-card");
    const issueCount = await issueCards.count();
    expect(issueCount).toBeGreaterThan(0);
  });

  test("a Playability Segment filters the list to its On the Floor machines", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("Mobile"),
      "Phones show the compact list, not the table this test counts; the Issues Severity test covers Segment selection on phones"
    );
    await page.goto("/m?presence=all");
    const playability = page.getByRole("region", { name: "Playability" });
    await expect(playability).toBeVisible();

    // Zero-count Segments are left out of the breakdown (widgets §5.5) and
    // pairs that do not fit roll into "N other" from the end (§5.6), so the
    // first pair on the line is a selectable Segment.
    const first = playability
      .getByRole("button", {
        name: /^\d+ (Unplayable|Needs Service|Operational)$/,
      })
      .first();
    await expect(first).toBeVisible();
    const label = ((await first.getAttribute("aria-label")) ?? "").replace(
      /^\d+ /,
      ""
    );
    const segment = playability.getByRole("button", {
      name: new RegExp(`^\\d+ ${label}$`),
    });
    await segment.click();

    const value = label.toLowerCase().replace(" ", "_");
    await expect(page).toHaveURL(new RegExp(`[?&]status=${value}(?:&|$)`));
    // On the Floor is the /m default, so the canonical URL drops `presence`
    // once the Segment replaces the starting `presence=all`.
    expect(new URL(page.url()).searchParams.has("presence")).toBe(false);
    // The Playability filter button shows the selected value (list-views §4.3).
    await expect(
      page.getByRole("button", {
        name: new RegExp(`^Playability\\s*:\\s*${label}$`),
      })
    ).toBeVisible();
    await expect(segment).toHaveAttribute("aria-pressed", "true");
    // Widget counts use the same derivation as the rows (widgets §4.3). The
    // seed has far fewer machines than one 25-row page, so every match shows.
    // Poll the count and the rows together after the filter applies: a count
    // read before the click goes stale when another worker adds a machine.
    const rows = page
      .getByRole("table")
      .getByRole("row")
      .filter({ has: page.getByRole("cell") });
    await expect
      .poll(
        async () => {
          const count = Number.parseInt(
            (await segment.getAttribute("aria-label")) ?? "",
            10
          );
          return (await rows.count()) === count;
        },
        { message: "the selected Segment's count equals the row count" }
      )
      .toBe(true);
  });

  test.describe("on a phone narrower than 390px", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("the Summary Row starts collapsed and an expanded choice survives a reload", async ({
      page,
    }) => {
      await page.goto("/m");
      const summaryRow = page.getByRole("button", {
        name: /^Summary: \d+\/\d+ playable$/,
      });
      const presence = page.getByRole("region", { name: "Presence" });
      await expect(summaryRow).toHaveAttribute("aria-expanded", "false");
      await expect(presence).not.toBeVisible();

      await summaryRow.click();
      await expect(summaryRow).toHaveAttribute("aria-expanded", "true");
      await expect(presence).toBeVisible();

      await page.reload();
      await expect(summaryRow).toHaveAttribute("aria-expanded", "true");
      await expect(presence).toBeVisible();
    });
  });

  test.describe("on a phone at least 390px wide", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the Summary Row starts open and a collapsed choice survives a reload", async ({
      page,
    }) => {
      await page.goto("/m");
      const summaryRow = page.getByRole("button", {
        name: /^Summary: \d+\/\d+ playable$/,
      });
      const presence = page.getByRole("region", { name: "Presence" });
      await expect(summaryRow).toHaveAttribute("aria-expanded", "true");
      await expect(presence).toBeVisible();

      await summaryRow.click();
      await expect(summaryRow).toHaveAttribute("aria-expanded", "false");
      await expect(presence).not.toBeVisible();

      await page.reload();
      await expect(summaryRow).toHaveAttribute("aria-expanded", "false");
      await expect(presence).not.toBeVisible();
    });
  });
});
