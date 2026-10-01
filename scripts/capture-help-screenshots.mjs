#!/usr/bin/env node
// scripts/capture-help-screenshots.mjs — regenerate the Pinball Map help
// article's screenshots (src/app/(app)/help/pinball-map/page.mdx) into
// public/help/pinball-map/.
//
// Usage:
//   node scripts/capture-help-screenshots.mjs [--only=a,b]
//
// Preconditions (not provisioned here):
//   - Supabase running with a fresh seed: `pnpm run db:reset`. The seeded
//     Pinball Map state (supabase/seed-pinballmap-state.ts) puts one machine
//     in each listing state these shots rely on (MM Missing, BK Lingering,
//     GDZ Shared, SC Alert, EBD Blocked, ...) and links the seeded admin to a
//     fake Pinball Map account.
//   - Imported comments: after the reset, set GDZ2 Off the lineup and back On
//     from its Manage tab. The intent change imports the seed's two Godzilla
//     comments. (A lineup Refresh would not: it swaps in the mock client's
//     raw fixture, which lacks them.)
//   - `pnpm run dev` on the worktree's PORT. Local dev autologin signs the
//     browser in as the seeded admin, so no storage state is needed. Shots
//     marked `as: "technician"` opt out of autologin and sign in as the seeded
//     technician from src/test/data/users.json, who has no linked Pinball Map
//     account.
//
// Every request goes to localhost and the Pinball Map client is the mock
// outside Vercel production, so nothing here reaches pinballmap.com. Shots
// open confirmation dialogs but never press their confirm button.

import { chromium } from "@playwright/test";
import nextEnv from "@next/env";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(repoRoot);
const port = process.env.PORT ?? "3000";
const baseURL = `http://localhost:${port}`;
const outDir = join(repoRoot, "public/help/pinball-map");

const PAD = 12;

/**
 * Each shot: a route, an optional setup step, and the element to capture.
 * `maxHeight` and `maxWidth` crop large elements to their top-left; `pad`
 * overrides the margin of page kept around the element (0 for dialogs, whose
 * backdrop would otherwise show). `as` picks the signed-in user (default:
 * the autologin admin).
 */
const SHOTS = [
  {
    id: "listing-control-in-sync",
    path: "/m/AFM/edit",
    target: (page) => page.getByTestId("pbm-listing-control"),
  },
  {
    id: "listing-control-missing",
    path: "/m/MM/edit",
    target: (page) => page.getByTestId("pbm-listing-control"),
  },
  {
    id: "listing-control-lingering",
    path: "/m/BK/edit",
    target: (page) => page.getByTestId("pbm-listing-control"),
  },
  {
    id: "listing-control-shared",
    path: "/m/GDZ/edit",
    target: (page) => page.getByTestId("pbm-listing-control"),
  },
  {
    id: "listing-control-covered",
    path: "/m/GDZ3/edit",
    target: (page) => page.getByTestId("pbm-listing-control"),
  },
  {
    id: "listing-control-alert",
    path: "/m/SC/edit",
    target: (page) => page.getByTestId("pbm-listing-control"),
  },
  {
    id: "listing-control-blocked",
    path: "/m/EBD/edit",
    target: (page) => page.getByTestId("pbm-listing-control"),
  },
  {
    id: "listing-control-no-account",
    path: "/m/MM/edit",
    as: "technician",
    target: (page) => page.getByTestId("pbm-listing-control"),
  },
  {
    id: "model-details",
    path: "/m/AFM/edit",
    // The box plus its "Model Details" heading, which sits outside it.
    target: (page) => page.getByTestId("model-details-section").locator(".."),
  },
  {
    id: "remove-confirm",
    path: "/m/BK/edit",
    setup: async (page) => {
      await page.getByTestId("pbm-listing-remove").click();
      // A lineup over 5 minutes old refreshes before the count shows.
      await page
        .getByRole("alertdialog")
        .getByText("Checking comments")
        .waitFor({ state: "hidden" });
    },
    target: (page) => page.getByRole("alertdialog"),
    pad: 0,
  },
  {
    id: "lineup-page",
    path: "/m/pinball-map",
    viewport: true,
    maxHeight: 780,
  },
  {
    id: "lineup-not-linked",
    path: "/m/pinball-map",
    target: (page) => page.getByTestId("pbm-lineup-section-pinball_map_only"),
    maxHeight: 330,
  },
  {
    id: "lineup-link-dialog",
    path: "/m/pinball-map",
    setup: async (page) => {
      await page.locator('[data-testid^="pbm-lineup-link-"]').first().click();
    },
    target: (page) => page.getByTestId("pbm-lineup-link-dialog"),
    pad: 0,
  },
  {
    id: "new-machine",
    path: "/m/pinball-map",
    setup: async (page) => {
      const href = await page
        .getByRole("link", { name: "Create in PinPoint" })
        .first()
        .getAttribute("href");
      if (href === null) throw new Error("No Create in PinPoint link");
      await page.goto(`${baseURL}${href}`);
      await page.waitForLoadState("networkidle");
    },
    target: (page) => page.getByTestId("new-machine-pbm"),
  },
  {
    id: "timeline-comment",
    path: "/m/GDZ/timeline",
    // The imported-comment row carries no test id; its Pinball Map pin icon is
    // what tells it apart from other timeline rows.
    target: (page) =>
      page
        .locator("div.flex.gap-3.border-b.py-3")
        .filter({ has: page.locator("svg.lucide-map-pin") })
        .filter({ hasText: "Building shot" })
        .first(),
    maxWidth: 760,
  },
  {
    id: "account-linked",
    path: "/settings",
    target: (page) => page.getByTestId("pinballmap-account-row"),
  },
  {
    id: "admin-integration",
    path: "/admin/integrations",
    target: (page) => page.getByTestId("pinballmap-integration-card"),
    maxHeight: 440,
  },
  {
    id: "admin-region-alerts",
    path: "/admin/integrations",
    target: (page) =>
      page.locator('section[aria-labelledby="pinballmap-region-alerts"]'),
  },
];

const only = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",");

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const contextOptions = {
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  reducedMotion: "reduce",
};

/** A page signed in as the seeded test user `role`, without autologin. */
async function signedInPage(role) {
  const users = JSON.parse(
    readFileSync(join(repoRoot, "src/test/data/users.json"), "utf8")
  );
  const user = users[role];
  if (user === undefined) throw new Error(`No seeded user "${role}"`);
  const context = await browser.newContext(contextOptions);
  await context.addCookies([
    { name: "skip_autologin", value: "1", url: baseURL },
  ]);
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`);
  await page.locator("input[name=email]").fill(user.email);
  await page.locator("#current-password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

const pages = new Map([
  ["admin", await (await browser.newContext(contextOptions)).newPage()],
]);

for (const shot of SHOTS) {
  if (only !== undefined && !only.includes(shot.id)) continue;
  const role = shot.as ?? "admin";
  if (!pages.has(role)) pages.set(role, await signedInPage(role));
  const page = pages.get(role);
  await page.goto(`${baseURL}${shot.path}`);
  await page.waitForLoadState("networkidle");
  // The Next.js dev-tools badge floats over the bottom-left corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
  if (shot.setup) await shot.setup(page);
  const file = join(outDir, `${shot.id}.png`);

  if (shot.viewport) {
    const size = page.viewportSize();
    if (size === null) throw new Error("No viewport");
    await page.screenshot({
      path: file,
      clip: {
        x: 0,
        y: 0,
        width: size.width,
        height: Math.min(size.height, shot.maxHeight ?? size.height),
      },
    });
  } else {
    const target = shot.target(page);
    await target.waitFor({ state: "visible" });
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (box === null) throw new Error(`${shot.id}: target has no box`);
    const pad = shot.pad ?? PAD;
    const width = Math.min(box.width, shot.maxWidth ?? box.width);
    const height = Math.min(box.height, shot.maxHeight ?? box.height);
    await page.screenshot({
      path: file,
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: width + pad * 2,
        height: height + pad * 2,
      },
    });
  }
  console.log(`✓ ${shot.id}`);
}

await browser.close();
