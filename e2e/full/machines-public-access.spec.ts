/**
 * Smoke Test: Public Machine Access
 *
 * Tests that unauthenticated users can view the machines list.
 * Verifies the "Add Machine" button is NOT visible to unauthenticated users.
 *
 * This test ensures the public routes for machines are working correctly
 * per the permission model: machines.view is public, machines.create is admin-only.
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

  test("unauthenticated user does NOT see Add Machine button", async ({
    page,
  }) => {
    await page.goto("/m");

    // Verify the "Add Machine" button is NOT visible to unauthenticated users
    await expect(
      page.getByRole("link", { name: /Add Machine/i })
    ).not.toBeVisible();

    // Verify no button exists in the page (not just hidden)
    const addButton = page.getByRole("link", { name: /Add Machine/i });
    expect(await addButton.count()).toBe(0);
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
      "Phones collapse the widgets; the phone test below covers that layout"
    );
    await page.goto("/m?presence=all");
    const playability = page.getByRole("region", { name: "Playability" });
    await expect(playability).toBeVisible();

    const segments = [
      { label: "Operational", value: "operational" },
      { label: "Needs Service", value: "needs_service" },
      { label: "Unplayable", value: "unplayable" },
    ];
    let chosen: { label: string; value: string; count: number } | null = null;
    for (const segment of segments) {
      const button = playability.getByRole("button", {
        name: new RegExp(`^\\d+ ${segment.label}$`),
      });
      if (await button.isEnabled()) {
        const name = (await button.getAttribute("aria-label")) ?? "";
        chosen = { ...segment, count: Number.parseInt(name, 10) };
        await button.click();
        break;
      }
    }
    if (chosen === null) throw new Error("No selectable Playability Segment");

    await expect(page).toHaveURL(
      new RegExp(`[?&]status=${chosen.value}(?:&|$)`)
    );
    // On the Floor is the /m default, so the canonical URL drops `presence`
    // once the Segment replaces the starting `presence=all`.
    expect(new URL(page.url()).searchParams.has("presence")).toBe(false);
    await expect(
      page.getByRole("button", { name: `Remove ${chosen.label} filter` })
    ).toBeVisible();
    // Widget counts use the same derivation as the rows (widgets §4.3). The
    // seed has far fewer machines than one 25-row page, so every match shows.
    await expect(
      page
        .getByRole("table")
        .getByRole("row")
        .filter({ has: page.getByRole("cell") })
    ).toHaveCount(chosen.count);
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the Summary Row expands and the choice survives a reload", async ({
      page,
    }) => {
      await page.goto("/m");
      const summaryRow = page.getByRole("button", {
        name: /machines? · \d+ of \d+ playable · \d+ open issues?/,
      });
      await expect(summaryRow).toHaveAttribute("aria-expanded", "false");
      await expect(
        page.getByRole("region", { name: "Presence" })
      ).not.toBeVisible();

      await summaryRow.click();
      const expanded = page.getByRole("button", { name: "Summary" });
      await expect(expanded).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.getByRole("region", { name: "Presence" })
      ).toBeVisible();

      await page.reload();
      await expect(
        page.getByRole("button", { name: "Summary" })
      ).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.getByRole("region", { name: "Presence" })
      ).toBeVisible();
    });
  });
});
