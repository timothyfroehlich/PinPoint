import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";

import { chromium, firefox, webkit, type FullConfig } from "@playwright/test";
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

const BROWSER_ENGINES: Record<BrowserName, { executablePath(): string }> = {
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
    const name = (project.use.browserName ?? "chromium") as BrowserName;
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
 * Verify the Docker daemon is up. Supabase's local stack runs in Docker, so
 * a missing daemon would surface as confusing Postgres connection failures.
 * Uses spawnSync (not exec) — no shell, fixed argv, safe.
 */
function checkDocker(): void {
  const result = spawnSync("docker", ["info"], {
    stdio: "ignore",
    timeout: 5000,
  });
  if (result.error?.code === "ENOENT") {
    throw new Error(
      "Docker is not installed.\n" +
        "  Install with: brew install --cask orbstack\n" +
        "  Or: brew install docker"
    );
  }
  if (result.error || result.status !== 0) {
    throw new Error(
      "Docker daemon is not running. Supabase's local stack needs it.\n" +
        "  Start OrbStack: open -a OrbStack\n" +
        "  Then wait a few seconds and re-run."
    );
  }
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

  console.log("🔍 Checking Docker daemon...");
  checkDocker();

  if (process.env.SKIP_SUPABASE_RESET === "true") {
    console.log("⏭️  SKIP_SUPABASE_RESET=true, skipping database setup.");
    return;
  }

  // ── Pre-flight checks ──────────────────────────────────────────────

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
  const postgresUrl =
    process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

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
