#!/usr/bin/env node
// scripts/workflow/pr-screenshots.mjs — local desktop + two mobile screenshots.
//
// Captures the pages in ui-screenshot-manifest.json at the three review
// viewports so the agent can show them to Tim in Claude Code Desktop chat
// (send the PNGs with the file-sending tool) BEFORE the PR's "UI Approval"
// check can pass. Nothing is uploaded to GitHub: no screenshot branch, no PR
// comment. The PNGs stay on this machine under tmp/.
//
// Usage:
//   node scripts/workflow/pr-screenshots.mjs [--pages=a,b,c] [--out=<dir>] [--force-auth]
//
//   --pages=a,b,c Optional comma-separated list of manifest page ids to shoot.
//                 Default: every page in ui-screenshot-manifest.json.
//                 Must use the EQUALS form — `--pages machine-edit` (space)
//                 fails with "Unrecognized argument".
//   --out=<dir>   Output directory (created if missing). Default:
//                 tmp/pr-screenshots/<current git short SHA>/ under the repo root.
//   --force-auth  Regenerate e2e/.auth/*.json storage state even if present
//                 (use when a previous session looks stale/expired).
//
// Output: files are named `<viewport>-<page-id>.png` (viewports: desktop,
// mobile-large, mobile-small). On success stdout is exactly one absolute path
// per PNG written and nothing else, so the list can be handed straight to the
// agent's file-sending tool. All progress and warnings go to stderr.
//
// Browser selection (env var):
//   PR_SHOTS_BROWSER=chromium|firefox  Force a specific renderer. When unset,
//   the default is Chromium with automatic fallback to Firefox if Chromium's
//   renderer crashes. Playwright's bundled Chromium segfaults mid-render on
//   OSes it doesn't officially support (e.g. Fedora Atomic / Bazzite — top-level
//   libs resolve so it launches, but a subtle ABI mismatch SIGSEGVs the renderer
//   on complex pages); Firefox is tolerant there. CI (Ubuntu) keeps Chromium.
//   (PP-rsy3.)
//
// Preconditions (best-effort, not auto-provisioned by this script):
//   - Local dev server running at http://localhost:<PORT> (`pnpm run dev`).
//     PORT is read from .env.local the same way playwright.config.ts does —
//     worktree-aware, always localhost (CORE-SEC-008).
//   - Supabase running (`pnpm supabase:start`).
//
// First run (or any run with missing/stale storage state) invokes
// `pnpm exec playwright test --project=auth-setup`, which — via
// e2e/global-setup.ts — resets and reseeds the local dev database. This is
// the same reset the E2E suite already does locally; it is NOT run against
// production. Subsequent runs reuse the saved storage state and do not reset
// the DB, unless it's missing or --force-auth is passed.
//
// Session staleness is detected automatically: before reusing e2e/.auth/*.json
// the saved Supabase session's expiry is decoded, and an expired/near-expired or
// unparseable session is regenerated just like a missing file (PP-chhn.1). See
// ensureAuthStorageState + auth-storage-state.mjs.
//
// Hardening follow-ups (deferred):
//   - No retry/backoff on flaky navigation (single attempt per page).

import { chromium, firefox } from "@playwright/test";
import nextEnv from "@next/env";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateStorageState } from "./auth-storage-state.mjs";

const { loadEnvConfig } = nextEnv;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

const MANIFEST_PATH = join(
  REPO_ROOT,
  "scripts/workflow/ui-screenshot-manifest.json"
);
const STORAGE_STATE = {
  admin: join(REPO_ROOT, "e2e/.auth/admin.json"),
  member: join(REPO_ROOT, "e2e/.auth/member.json"),
  technician: join(REPO_ROOT, "e2e/.auth/technician.json"),
};

// The review viewports from pinpoint-design-bible §4. Small mobile (320px) is
// the layout floor: a member runs their phone zoomed in.
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, label: "Desktop (1440×900)" },
  "mobile-large": { width: 430, height: 932, label: "Large mobile (430×932)" },
  "mobile-small": { width: 320, height: 568, label: "Small mobile (320×568)" },
};

function parseArgs(argv) {
  let pagesFilter;
  let outDir;
  let forceAuth = false;

  for (const arg of argv) {
    if (arg === "--force-auth") {
      forceAuth = true;
    } else if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length).trim();
      if (!outDir) throw new Error("--out requires a directory");
    } else if (arg.startsWith("--pages")) {
      const value = arg.includes("=") ? arg.split("=")[1] : "";
      pagesFilter = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      throw new Error(
        `Unrecognized argument: ${arg}\n` +
          "Usage: node scripts/workflow/pr-screenshots.mjs [--pages=a,b,c] [--out=<dir>] [--force-auth]"
      );
    }
  }

  return { pagesFilter, outDir, forceAuth };
}

function loadManifest(pagesFilter) {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const entries = Object.entries(raw).filter(([id]) => !id.startsWith("_"));
  const selected = pagesFilter
    ? entries.filter(([id]) => pagesFilter.includes(id))
    : entries;

  if (selected.length === 0) {
    throw new Error(
      pagesFilter
        ? `No manifest pages matched --pages=${pagesFilter.join(",")}`
        : "ui-screenshot-manifest.json has no pages defined"
    );
  }

  for (const [id, page] of selected) {
    if (!STORAGE_STATE[page.authRole]) {
      throw new Error(
        `Manifest page "${id}" has unknown authRole "${page.authRole}" (expected one of ${Object.keys(STORAGE_STATE).join(", ")})`
      );
    }
  }

  return selected.map(([id, page]) => ({ id, ...page }));
}

function resolveBaseUrl() {
  loadEnvConfig(REPO_ROOT, true);
  const port = Number(process.env.PORT ?? "3000");
  return `http://localhost:${port}`;
}

async function checkServerReachable(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function ensureAuthStorageState(rolesNeeded, forceAuth) {
  // A file that merely EXISTS is not enough: an expired session passes an
  // existence check but hands the browser a dead cookie, so the capture is of a
  // logged-out / redirected page rather than the real one (PP-chhn.1). Treat a
  // missing file, a corrupt one, and an expired-or-about-to-expire session all
  // as "regenerate", and say which it is.
  const needsRegen = [];
  for (const role of rolesNeeded) {
    if (forceAuth) {
      needsRegen.push({ role, reason: "--force-auth" });
      continue;
    }
    const { fresh, reason } = evaluateStorageState(STORAGE_STATE[role]);
    if (!fresh) needsRegen.push({ role, reason });
  }

  if (needsRegen.length === 0) {
    console.error(
      `✅ Auth storage state present and unexpired for: ${rolesNeeded.join(", ")}`
    );
    return;
  }

  console.error(
    "🔐 Auth storage state needs regeneration:\n" +
      needsRegen
        .map(({ role, reason }) => `   • ${role} — ${reason}`)
        .join("\n") +
      "\nRegenerating via `pnpm exec playwright test --project=auth-setup` " +
      "(this resets + reseeds the local dev DB — same as running E2E tests locally)."
  );
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "--project=auth-setup"],
    { cwd: REPO_ROOT, stdio: ["ignore", 2, 2], env: process.env }
  );
  if (result.status !== 0) {
    throw new Error(
      "auth-setup failed — see output above. Ensure the dev server + Supabase " +
        "can start locally (pnpm run dev / pnpm supabase:start)."
    );
  }
}

const BROWSERS = { chromium, firefox };

/**
 * Capture every page×viewport with the given browser type. Returns the captured
 * shots plus a `crashed` flag — the renderer segfaulting (Playwright's bundled
 * Chromium does this on OSes it doesn't officially support, e.g. Fedora Atomic /
 * Bazzite) surfaces as a page "crash" event or a "crash"-worded goto error, which
 * the caller uses to decide whether to fall back to another browser.
 */
async function captureScreenshots(browserType, baseUrl, pages, workDir) {
  const rolesNeeded = [...new Set(pages.map((p) => p.authRole))];
  const browser = await browserType.launch();
  /** @type {Map<string, import("@playwright/test").BrowserContext>} */
  const contexts = new Map();
  const captured = [];
  let crashed = false;

  try {
    for (const role of rolesNeeded) {
      for (const [vpName, { width, height }] of Object.entries(VIEWPORTS)) {
        const ctx = await browser.newContext({
          storageState: STORAGE_STATE[role],
          viewport: { width, height },
          baseURL: baseUrl,
        });
        contexts.set(`${role}:${vpName}`, ctx);
      }
    }

    for (const page of pages) {
      for (const vpName of Object.keys(VIEWPORTS)) {
        const ctx = contexts.get(`${page.authRole}:${vpName}`);
        const pw = await ctx.newPage();
        pw.on("crash", () => {
          crashed = true;
        });
        console.error(`📸 ${vpName} — ${page.label} (${page.route})`);
        try {
          await pw.goto(page.route, {
            waitUntil: "networkidle",
            timeout: 15000,
          });
          const fileName = `${vpName}-${page.id}.png`;
          const outPath = join(workDir, fileName);
          await pw.screenshot({ path: outPath });
          captured.push({
            id: page.id,
            label: page.label,
            vpName,
            fileName,
            outPath,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (/crash/i.test(message)) crashed = true;
          console.error(
            `⚠️  Failed to capture ${vpName}/${page.id}: ${message}`
          );
        } finally {
          await pw.close().catch(() => {});
        }
      }
    }
  } finally {
    for (const ctx of contexts.values()) {
      await ctx.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }

  return { captured, crashed };
}

/**
 * Run the capture with the selected browser, falling back to Firefox if
 * Chromium's renderer crashes. Honors PR_SHOTS_BROWSER=chromium|firefox as an
 * explicit override (no fallback when forced). (PP-rsy3.)
 */
async function captureWithFallback(baseUrl, pages, workDir) {
  const forced = process.env.PR_SHOTS_BROWSER;
  if (forced && !BROWSERS[forced]) {
    throw new Error(
      `PR_SHOTS_BROWSER="${forced}" is invalid — expected one of: ${Object.keys(BROWSERS).join(", ")}`
    );
  }
  const order = forced ? [forced] : ["chromium", "firefox"];

  for (let i = 0; i < order.length; i++) {
    const name = order[i];
    console.error(`🖥️  Capturing with ${name}${forced ? " (forced)" : ""}`);
    const { captured, crashed } = await captureScreenshots(
      BROWSERS[name],
      baseUrl,
      pages,
      workDir
    );
    const hasNext = i < order.length - 1;
    if (crashed && hasNext) {
      console.error(
        `⚠️  ${name} renderer crashed (known on OSes Playwright doesn't officially ` +
          `support, e.g. Fedora Atomic / Bazzite) — retrying with ${order[i + 1]}.`
      );
      continue;
    }
    return captured;
  }
  return [];
}

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...opts }).trim();
}

async function main() {
  const { pagesFilter, outDir, forceAuth } = parseArgs(process.argv.slice(2));

  const headSha = git(["rev-parse", "--short", "HEAD"], { cwd: REPO_ROOT });
  // The dev server renders the working tree, so uncommitted edits would appear in
  // pictures filed under a commit that lacks them; Tim's approval is recorded
  // against a commit (approve-ui.sh --head), so the directory says so.
  const dirty =
    git(["status", "--porcelain", "--untracked-files=no"], {
      cwd: REPO_ROOT,
    }) !== "";
  if (dirty) {
    console.error(
      "⚠️  Uncommitted changes: these screenshots match no commit. Commit and push before showing Tim."
    );
  }
  const shortSha = dirty ? `${headSha}-dirty` : headSha;
  const workDir = outDir
    ? isAbsolute(outDir)
      ? outDir
      : resolve(process.cwd(), outDir)
    : join(REPO_ROOT, "tmp", "pr-screenshots", shortSha);

  const pages = loadManifest(pagesFilter);
  const baseUrl = resolveBaseUrl();
  const healthy = await checkServerReachable(baseUrl);
  if (!healthy) {
    throw new Error(
      `Dev server not reachable at ${baseUrl}/api/health. Start it first: pnpm run dev`
    );
  }

  const rolesNeeded = [...new Set(pages.map((p) => p.authRole))];
  ensureAuthStorageState(rolesNeeded, forceAuth);

  mkdirSync(workDir, { recursive: true });
  const captured = await captureWithFallback(baseUrl, pages, workDir);
  if (captured.length === 0) {
    throw new Error(
      "No screenshots captured — every page failed. See errors above."
    );
  }

  console.error(`✅ Captured ${captured.length} screenshot(s) in ${workDir}`);
  // stdout contract: one absolute path per PNG, nothing else.
  for (const shot of captured) {
    process.stdout.write(`${shot.outPath}\n`);
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
