#!/usr/bin/env node
// scripts/workflow/pr-screenshots.mjs — desktop+mobile screenshots for a PR.
//
// PP-wi85: UI-touching PRs must have screenshots posted before handoff to Tim
// so he can eyeball them before running the (human-only) merge. This script
// shoots a manifest of key pages at two viewports, pushes the PNGs to a
// dedicated orphan `pr-screenshots` branch (repo is public, so raw.githubusercontent.com
// URLs render inline in the PR comment), and posts/updates one sticky PR comment.
//
// Usage:
//   node scripts/workflow/pr-screenshots.mjs <PR> [--pages=a,b,c] [--force-auth]
//
//   <PR>          Required. GitHub PR number — used for the screenshot storage
//                 path and the sticky comment target.
//   --pages=a,b,c Optional comma-separated list of manifest page ids to shoot.
//                 Default: every page in ui-screenshot-manifest.json.
//   --force-auth  Regenerate e2e/.auth/*.json storage state even if present
//                 (use when a previous session looks stale/expired).
//
// Preconditions (best-effort, not auto-provisioned by this script):
//   - Local dev server running at http://localhost:<PORT> (`pnpm run dev`).
//     PORT is read from .env.local the same way playwright.config.ts does —
//     worktree-aware, always localhost (CORE-SEC-008).
//   - Local Supabase running (`supabase start`).
//   - `gh` CLI authenticated.
//
// First run (or any run with missing/stale storage state) invokes
// `pnpm exec playwright test --project=auth-setup`, which — via
// e2e/global-setup.ts — resets and reseeds the local dev database. This is
// the same reset the E2E suite already does locally; it is NOT run against
// production. Subsequent runs reuse the saved storage state and do not reset
// the DB, unless it's missing or --force-auth is passed.
//
// Hardening follow-ups (deferred — see PR description / spec doc):
//   - No retry/backoff on flaky navigation (single attempt per page).
//   - Session staleness is only handled via the manual --force-auth escape
//     hatch, not detected automatically.
//   - The pr-screenshots branch has no pruning/TTL (unlike the preview-deployment
//     reaper) — it will grow unbounded over time.
//   - PR-number/branch mismatch is a warning, not a hard failure.

import { chromium } from "@playwright/test";
import nextEnv from "@next/env";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const SCREENSHOTS_BRANCH = "pr-screenshots";
const COMMENT_MARKER = "<!-- pr-screenshots -->";

function parseArgs(argv) {
  let pr;
  let pagesFilter;
  let forceAuth = false;

  for (const arg of argv) {
    if (arg === "--force-auth") {
      forceAuth = true;
    } else if (arg.startsWith("--pages")) {
      const value = arg.includes("=") ? arg.split("=")[1] : "";
      pagesFilter = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (!arg.startsWith("--") && pr === undefined) {
      pr = arg;
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }

  if (!pr || !/^\d+$/.test(pr)) {
    throw new Error(
      "Usage: node scripts/workflow/pr-screenshots.mjs <PR> [--pages=a,b,c] [--force-auth]"
    );
  }

  return { pr, pagesFilter, forceAuth };
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
  const missing = forceAuth
    ? rolesNeeded
    : rolesNeeded.filter((role) => !existsSync(STORAGE_STATE[role]));

  if (missing.length === 0) {
    console.log(`✅ Auth storage state present for: ${rolesNeeded.join(", ")}`);
    return;
  }

  console.log(
    `🔐 Auth storage state missing/stale for: ${missing.join(", ")}. ` +
      "Regenerating via `pnpm exec playwright test --project=auth-setup` " +
      "(this resets + reseeds the local dev DB — same as running E2E tests locally)."
  );
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "--project=auth-setup"],
    { cwd: REPO_ROOT, stdio: "inherit", env: process.env }
  );
  if (result.status !== 0) {
    throw new Error(
      "auth-setup failed — see output above. Ensure the dev server + Supabase " +
        "can start locally (pnpm run dev / supabase start)."
    );
  }
}

async function captureScreenshots(baseUrl, pages, workDir) {
  const rolesNeeded = [...new Set(pages.map((p) => p.authRole))];
  const browser = await chromium.launch();
  /** @type {Map<string, import("@playwright/test").BrowserContext>} */
  const contexts = new Map();
  const captured = [];

  try {
    for (const role of rolesNeeded) {
      for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
        const ctx = await browser.newContext({
          storageState: STORAGE_STATE[role],
          viewport: vp,
          baseURL: baseUrl,
        });
        contexts.set(`${role}:${vpName}`, ctx);
      }
    }

    for (const page of pages) {
      for (const vpName of Object.keys(VIEWPORTS)) {
        const ctx = contexts.get(`${page.authRole}:${vpName}`);
        const pw = await ctx.newPage();
        console.log(`📸 ${vpName} — ${page.label} (${page.route})`);
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
          console.error(
            `⚠️  Failed to capture ${vpName}/${page.id}: ${error instanceof Error ? error.message : error}`
          );
        } finally {
          await pw.close();
        }
      }
    }
  } finally {
    for (const ctx of contexts.values()) {
      await ctx.close();
    }
    await browser.close();
  }

  return captured;
}

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...opts }).trim();
}

function ghJson(args) {
  return JSON.parse(execFileSync("gh", args, { encoding: "utf8" }));
}

/**
 * Push captured PNGs to the orphan `pr-screenshots` branch under
 * pr-<N>/<shortsha>/<file>. Runs entirely inside a throwaway temp dir with
 * its own fresh `git init` (NOT `git worktree add` against the main repo) so
 * it never touches the working tree and never trips the repo's Husky
 * post-checkout hook (which would otherwise allocate a worktree port slot
 * for a directory that only exists to hold PNGs for a few seconds).
 */
function publishScreenshots(pr, shortSha, captured) {
  const remoteUrl = git(["remote", "get-url", "origin"], { cwd: REPO_ROOT });
  const tmpDir = mkdtempSync(join(tmpdir(), "pr-screenshots-"));

  try {
    git(["init", "-q", "-b", SCREENSHOTS_BRANCH], { cwd: tmpDir });
    git(["config", "user.email", "pinpoint-bot@users.noreply.github.com"], {
      cwd: tmpDir,
    });
    git(["config", "user.name", "PinPoint Screenshot Bot"], { cwd: tmpDir });
    git(["remote", "add", "origin", remoteUrl], { cwd: tmpDir });

    try {
      git(["fetch", "-q", "--depth", "1", "origin", SCREENSHOTS_BRANCH], {
        cwd: tmpDir,
      });
      git(["checkout", "-q", "-B", SCREENSHOTS_BRANCH, "FETCH_HEAD"], {
        cwd: tmpDir,
      });
    } catch {
      console.log(
        `ℹ️  Remote branch "${SCREENSHOTS_BRANCH}" doesn't exist yet — creating it.`
      );
    }

    const destDir = join(tmpDir, `pr-${pr}`, shortSha);
    mkdirSync(destDir, { recursive: true });
    const remotePaths = [];
    for (const shot of captured) {
      const dest = join(destDir, shot.fileName);
      writeFileSync(dest, readFileSync(shot.outPath));
      remotePaths.push(`pr-${pr}/${shortSha}/${shot.fileName}`);
    }

    git(["add", "-A"], { cwd: tmpDir });
    git(["commit", "-q", "-m", `screenshots: PR #${pr} @ ${shortSha}`], {
      cwd: tmpDir,
    });
    git(["push", "-q", "origin", `HEAD:${SCREENSHOTS_BRANCH}`], {
      cwd: tmpDir,
    });

    return remotePaths;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function buildCommentBody(repoSlug, pr, shortSha, captured) {
  const byPage = new Map();
  for (const shot of captured) {
    if (!byPage.has(shot.id))
      byPage.set(shot.id, { label: shot.label, desktop: null, mobile: null });
    byPage.get(shot.id)[shot.vpName] = shot.fileName;
  }

  const rawBase = `https://raw.githubusercontent.com/${repoSlug}/${SCREENSHOTS_BRANCH}/pr-${pr}/${shortSha}`;

  const sections = [...byPage.values()].map(({ label, desktop, mobile }) => {
    const desktopCell = desktop
      ? `![desktop](${rawBase}/${desktop})`
      : "_capture failed_";
    const mobileCell = mobile
      ? `![mobile](${rawBase}/${mobile})`
      : "_capture failed_";
    return [
      `### ${label}`,
      "",
      "| Desktop (1440×900) | Mobile (390×844) |",
      "| --- | --- |",
      `| ${desktopCell} | ${mobileCell} |`,
      "",
    ].join("\n");
  });

  return [
    COMMENT_MARKER,
    `## UI Screenshots — head \`${shortSha}\``,
    "",
    ...sections,
  ].join("\n");
}

function postOrUpdateStickyComment(repoSlug, pr, body) {
  // `--paginate` concatenates one JSON array per page back-to-back, which isn't
  // valid single-document JSON — slurp+flatten via jq (same approach as
  // mark-claude-review.sh) so a marker comment on page 2+ of a busy PR isn't missed.
  const raw = execFileSync(
    "gh",
    ["api", "--paginate", `repos/${repoSlug}/issues/${pr}/comments`],
    { encoding: "utf8" }
  );
  const flattened = execFileSync("jq", ["-s", "add"], {
    input: raw,
    encoding: "utf8",
  });
  const list = JSON.parse(flattened);
  const stickyComment = list.find((c) => c.body?.startsWith(COMMENT_MARKER));

  if (stickyComment) {
    console.log(
      `✏️  Updating sticky screenshot comment (id=${stickyComment.id})`
    );
    return ghJson([
      "api",
      "--method",
      "PATCH",
      `repos/${repoSlug}/issues/comments/${stickyComment.id}`,
      "-f",
      `body=${body}`,
      "--jq",
      ".html_url",
    ]);
  }

  console.log("📝 Posting new sticky screenshot comment");
  return ghJson([
    "api",
    "--method",
    "POST",
    `repos/${repoSlug}/issues/${pr}/comments`,
    "-f",
    `body=${body}`,
    "--jq",
    ".html_url",
  ]);
}

async function main() {
  const { pr, pagesFilter, forceAuth } = parseArgs(process.argv.slice(2));
  const pages = loadManifest(pagesFilter);

  const shortSha = git(["rev-parse", "--short", "HEAD"], { cwd: REPO_ROOT });

  // Best-effort sanity check — warn, don't fail, if local HEAD doesn't match
  // the PR's head on GitHub (e.g. forgot to push, or wrong branch checked out).
  try {
    const prHead = execFileSync(
      "gh",
      ["pr", "view", pr, "--json", "headRefOid", "--jq", ".headRefOid"],
      { cwd: REPO_ROOT, encoding: "utf8" }
    ).trim();
    if (
      !prHead.startsWith(shortSha) &&
      !shortSha.startsWith(prHead.slice(0, shortSha.length))
    ) {
      console.warn(
        `⚠️  Local HEAD (${shortSha}) doesn't match PR #${pr}'s remote head (${prHead.slice(0, 7)}). ` +
          "Screenshots will be taken of local HEAD, not the PR's pushed head — push first if they should match."
      );
    }
  } catch {
    console.warn(
      `⚠️  Could not verify PR #${pr}'s head via gh — continuing anyway.`
    );
  }

  const baseUrl = resolveBaseUrl();
  const healthy = await checkServerReachable(baseUrl);
  if (!healthy) {
    throw new Error(
      `Dev server not reachable at ${baseUrl}/api/health. Start it first: pnpm run dev`
    );
  }

  const rolesNeeded = [...new Set(pages.map((p) => p.authRole))];
  ensureAuthStorageState(rolesNeeded, forceAuth);

  const workDir = mkdtempSync(join(tmpdir(), "pr-screenshots-capture-"));
  let captured;
  try {
    captured = await captureScreenshots(baseUrl, pages, workDir);
    if (captured.length === 0) {
      throw new Error(
        "No screenshots captured — every page failed. See errors above."
      );
    }

    const remotePaths = publishScreenshots(pr, shortSha, captured);
    console.log(
      `✅ Pushed ${remotePaths.length} screenshot(s) to ${SCREENSHOTS_BRANCH}`
    );

    const repoSlug = execFileSync(
      "gh",
      ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
      { cwd: REPO_ROOT, encoding: "utf8" }
    ).trim();

    const body = buildCommentBody(repoSlug, pr, shortSha, captured);
    const commentUrl = postOrUpdateStickyComment(repoSlug, pr, body);
    console.log(`✅ Sticky comment: ${commentUrl}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
