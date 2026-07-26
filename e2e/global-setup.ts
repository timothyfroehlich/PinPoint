import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";

import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserType,
  type FullConfig,
} from "@playwright/test";
import postgres from "postgres";

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.password = "***";
    return parsed.toString();
  } catch {
    return "(unparseable URL)";
  }
}

type BrowserName = "chromium" | "firefox" | "webkit";

const BROWSER_ENGINES: Record<BrowserName, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

/**
 * Verify Playwright browser binaries are installed for every project the
 * active config will run. Failing fast here turns a cryptic mid-run
 * `browserType.launch: Executable doesn't exist` into an actionable error.
 *
 * Only checks browsers the active config actually needs — CI installs
 * chromium only, so blanket-checking firefox/webkit would break CI.
 */
function checkBrowserBinaries(config: FullConfig): void {
  const needed = new Set<BrowserName>();
  for (const project of config.projects) {
    const name = project.use.browserName ?? "chromium";
    if (name in BROWSER_ENGINES) needed.add(name);
  }

  const missing: BrowserName[] = [];
  for (const browser of needed) {
    try {
      if (!existsSync(BROWSER_ENGINES[browser].executablePath())) {
        missing.push(browser);
      }
    } catch {
      missing.push(browser);
    }
  }

  if (missing.length > 0) {
    const names = missing.join(" ");
    throw new Error(
      `Missing Playwright browser binaries: ${names}.\n` +
        `  Install with: pnpm exec playwright install --with-deps ${names}`
    );
  }
}

/**
 * An engine that is *installed* but cannot render text is worse than one
 * that's missing: every spec fails later with an unrelated-looking assertion
 * instead of an error naming the real problem. Two real instances, both on
 * Fedora Atomic (Bazzite):
 *
 *   - Chromium: a stale `~/.cache/fontconfig` entry made fontconfig report
 *     zero fonts, so Skia CHECK-failed in SkFontMgr_FontConfigInterface and
 *     the renderer died the instant a spec typed into a field. It presented
 *     as `fill()` silently no-opping — auth-setup just kept landing on
 *     /login — and cost several days across sessions (PP-8b6j, PP-rsy3).
 *     It does not self-heal: ostree pins /usr/share/fonts to mtime 0, and
 *     fontconfig keys cache validity on directory mtime, so a bad entry is
 *     never invalidated.
 *   - WebKit: MiniBrowser needs libicudata.so.74, which Fedora 43 doesn't
 *     ship, so every Mobile Safari spec dies at launch.
 *
 * So probe each engine once: launch it and confirm it can shape a run of
 * text. Chromium is fatal — auth-setup runs there, so nothing downstream can
 * pass without it. Other engines only warn, letting a host with a broken
 * WebKit still run its Chromium and Firefox projects.
 *
 * Probes the engines that are *installed* rather than the ones this config
 * declares, deliberately. `FullConfig.projects` is not filtered by
 * `--project`, and device-based projects leave `use.browserName` undefined
 * (the engine rides on `defaultBrowserType`), so config introspection would
 * demand firefox/webkit during CI's chromium-only runs. Keying off installed
 * binaries keeps CI honest — it installs exactly the engines it runs — while
 * still covering every engine a local run can reach. Missing binaries stay
 * `checkBrowserBinaries`' job.
 */
interface BrowserProbeFailure {
  browser: BrowserName;
  detail: string;
  remedy: string;
}

const TEXT_PROBE_HTML =
  '<!doctype html><meta charset="utf-8"><span id="probe">PinPoint</span>';

function probeRemedy(browser: BrowserName, message: string): string {
  const missingLib = /error while loading shared libraries: ([^\s:]+)/.exec(
    message
  );
  if (missingLib) {
    return (
      `missing system library ${missingLib[1]}\n` +
      `      Try: pnpm exec playwright install-deps ${browser}\n` +
      `      Fedora/ostree hosts have no install-deps support — install the\n` +
      `      matching system package, or leave this engine to CI.`
    );
  }
  return (
    `launched but rendered no glyphs — the host font stack is broken\n` +
    `      Try: rm -f ~/.cache/fontconfig/*.cache-* && fc-cache -f\n` +
    `      ostree hosts pin /usr/share/fonts to mtime 0, so fontconfig never\n` +
    `      invalidates a stale cache entry on its own. See PP-8b6j.`
  );
}

async function probeBrowser(
  browser: BrowserName
): Promise<BrowserProbeFailure | null> {
  let instance: Browser | undefined;
  try {
    instance = await BROWSER_ENGINES[browser].launch();
    const page = await instance.newPage();
    await page.setContent(TEXT_PROBE_HTML);
    // Zero width means fontconfig handed the engine no usable font. Chromium
    // usually aborts outright before reaching here; Firefox/WebKit degrade to
    // an unrendered run instead, so measure rather than trusting a clean launch.
    const width = await page.evaluate(
      () => document.getElementById("probe")?.getBoundingClientRect().width ?? 0
    );
    if (width > 0) return null;
    return {
      browser,
      detail: "text measured 0px wide",
      remedy: probeRemedy(browser, ""),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      browser,
      detail: message.split("\n")[0] ?? message,
      remedy: probeRemedy(browser, message),
    };
  } finally {
    if (instance) await instance.close().catch(() => undefined);
  }
}

const BROWSER_NAMES: readonly BrowserName[] = ["chromium", "firefox", "webkit"];

function installedBrowsers(): readonly BrowserName[] {
  return BROWSER_NAMES.filter((browser) => {
    try {
      return existsSync(BROWSER_ENGINES[browser].executablePath());
    } catch {
      return false;
    }
  });
}

async function checkBrowsersRenderText(): Promise<void> {
  const probes = await Promise.all(
    installedBrowsers().map((browser) => probeBrowser(browser))
  );
  const failures = probes.filter(
    (probe): probe is BrowserProbeFailure => probe !== null
  );
  if (failures.length === 0) return;

  const describe = (failure: BrowserProbeFailure): string =>
    `  ✗ ${failure.browser}: ${failure.detail}\n      ${failure.remedy}`;

  if (failures.some((failure) => failure.browser === "chromium")) {
    throw new Error(
      "Browser engine cannot render text — every spec would fail downstream:\n" +
        failures.map(describe).join("\n")
    );
  }

  console.warn(
    "⚠️  Unusable browser engine(s) on this host — their projects will fail:"
  );
  for (const failure of failures) console.warn(describe(failure));
}

/**
 * Block the current thread for `ms` milliseconds without a shell or child
 * process. Used to pace Docker readiness retries. `Atomics.wait` on a throwaway
 * SharedArrayBuffer is the standard synchronous-sleep primitive in Node.
 */
function sleepSync(ms: number): void {
  // Guard non-finite values: Atomics.wait coerces NaN to +Infinity and would
  // block forever, defeating the bounded readiness budget.
  if (!Number.isFinite(ms) || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Read a numeric env override, falling back to `fallback` when unset or
 * invalid (e.g. a typo'd `E2E_DOCKER_READY_DELAY_MS=abc` → NaN). Keeps the
 * Docker readiness budget bounded regardless of bad input.
 */
function numEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/**
 * Verify the Docker daemon is up. Supabase's local stack runs in Docker, so
 * a missing daemon would surface as confusing Postgres connection failures.
 * Uses spawnSync (not exec) — no shell, fixed argv, safe.
 *
 * On CI the runner's Docker daemon can still be coming up when global-setup
 * runs, so a single-shot check races daemon startup and fails spuriously
 * (PP-149t). Poll `docker info` with a bounded retry budget instead, tolerating
 * a brief startup delay. A missing binary (ENOENT) is fatal immediately —
 * retrying won't install Docker. Budget is tunable via env for CI.
 */
function checkDocker(): void {
  const attempts = Math.floor(numEnv("E2E_DOCKER_READY_ATTEMPTS", 15, 1));
  const delayMs = numEnv("E2E_DOCKER_READY_DELAY_MS", 1000, 0);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = spawnSync("docker", ["info"], {
      stdio: "ignore",
      timeout: 5000,
    });

    if (
      result.error &&
      "code" in result.error &&
      result.error.code === "ENOENT"
    ) {
      throw new Error(
        "Docker is not installed.\n" +
          "  Install OrbStack, Docker Desktop, or Docker Engine (whichever your platform supports).\n" +
          "  Mac: brew install --cask orbstack"
      );
    }

    if (!result.error && result.status === 0) {
      if (attempt > 1) {
        console.log(`✅ Docker daemon ready (attempt ${attempt}/${attempts}).`);
      }
      return;
    }

    if (attempt < attempts) {
      console.log(
        `⏳ Docker daemon not ready (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms...`
      );
      sleepSync(delayMs);
    }
  }

  throw new Error(
    `Docker daemon is not running after ${attempts} attempts. Supabase's local stack needs it.\n` +
      "  Start your Docker daemon (e.g., OrbStack, Docker Desktop, Colima, or `systemctl start docker`).\n" +
      "  Then wait a few seconds and re-run."
  );
}

/**
 * Playwright Global Setup
 *
 * Single orchestrator for test environment readiness.
 * Runs once before all tests. Flow:
 *   1. Pre-flight: verify browsers, Docker, Supabase, and Postgres
 *   2. Run migrations (idempotent — handles fresh checkout & post-merge)
 *   3. Fast-reset database (truncate + seed)
 *   4. Full reset fallback if fast-reset fails
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  // Browser + Docker checks run regardless of SKIP_SUPABASE_RESET. SKIP only
  // skips the DB reset/migration/seed; browsers and the docker daemon still
  // need to be there for tests to launch.
  console.log("🔍 Checking Playwright browser binaries...");
  checkBrowserBinaries(config);
  await checkBrowsersRenderText();

  console.log("🔍 Checking Docker daemon...");
  checkDocker();

  if (process.env["SKIP_SUPABASE_RESET"] === "true") {
    console.log("⏭️  SKIP_SUPABASE_RESET=true, skipping database setup.");
    return;
  }

  // ── Pre-flight checks ──────────────────────────────────────────────

  const supabaseUrl =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://localhost:54321";
  const postgresUrl =
    process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["POSTGRES_URL"];

  // 1. Supabase API health
  console.log("🔍 Checking Supabase...");
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "connection failed";
    throw new Error(
      `Supabase is not reachable at ${supabaseUrl} (${msg}).\n` +
        `  Start it with: supabase start\n` +
        `  Or check that you're in the right worktree directory.`,
      { cause: error }
    );
  }

  // 2. Postgres connectivity
  if (!postgresUrl) {
    throw new Error(
      "POSTGRES_URL is not set. Check your .env.local file.\n" +
        `  Check your .env.local or switch branches to regenerate it.`
    );
  }
  console.log("🔍 Checking Postgres...");
  const client = postgres(postgresUrl, { connect_timeout: 3 });
  try {
    await client`SELECT 1`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "connection failed";
    throw new Error(
      `Cannot connect to Postgres (${msg}).\n` +
        `  URL: ${redactUrl(postgresUrl)}\n` +
        `  Is Supabase running? Try: supabase status`,
      { cause: error }
    );
  } finally {
    await client.end();
  }

  console.log("✅ Pre-flight checks passed");

  // Sweep throwaway invite-signup users (…@example.com) that accumulate in
  // auth.users across runs. Neither db:fast-reset nor /api/test-data/cleanup
  // can delete auth.users rows (the Postgres role lacks the privilege), so
  // without this they grow unbounded. Once auth.users exceeds one Admin-API
  // page (GoTrue defaults to 50/page), any *unpaginated* listUsers() email
  // lookup misses real seed users that fall onto page 2+ (PP-ph46). Non-fatal:
  // a sweep hiccup shouldn't block the suite.
  //
  // Dynamic import (not static) on purpose: supabase-admin.ts throws at module
  // load if SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL are unset, and
  // the SKIP_SUPABASE_RESET=true path returns early above without ever needing
  // it — a top-level import would defeat that skip. Don't convert to static.
  try {
    const { cleanupInviteSignupUsers } =
      await import("./support/supabase-admin.js");
    const removed = await cleanupInviteSignupUsers();
    if (removed > 0) {
      console.log(`🧹 Swept ${removed} throwaway @example.com auth user(s).`);
    }
  } catch (error) {
    console.warn("⚠️  Failed to sweep throwaway auth users:", error);
  }

  // ── Database setup ─────────────────────────────────────────────────
  // All commands below are static strings (no user input) — execSync is safe here.

  // 3. Run migrations (idempotent — no-ops if up-to-date, applies new ones if needed)
  console.log("📋 Running migrations...");
  execSync("pnpm run db:migrate", { stdio: "inherit", env: process.env });

  // 4. Fast reset: truncate tables + re-seed
  try {
    console.log("⚡ Fast-resetting database...");
    execSync("pnpm run db:fast-reset", { stdio: "inherit", env: process.env });
    console.log("✅ Database ready");
    return;
  } catch {
    console.warn("⚠️  Fast reset failed, falling back to full reset...");
  }

  // 5. Full reset fallback (fresh checkout with empty database)
  try {
    execSync("supabase db reset --yes", { stdio: "inherit", env: process.env });
    execSync("pnpm run db:migrate", { stdio: "inherit", env: process.env });
    execSync("pnpm run test:_generate-schema", {
      stdio: "inherit",
      env: process.env,
    });
    execSync("pnpm run db:_seed", { stdio: "inherit", env: process.env });
    execSync("pnpm run db:_seed-users", { stdio: "inherit", env: process.env });
    console.log("✅ Database ready (full reset)");
  } catch (error) {
    console.error("❌ Failed to setup database:", error);
    throw error;
  }
}
