import { execSync } from "child_process";
import postgres from "postgres";

/**
 * Playwright Global Setup
 *
 * Single orchestrator for test environment readiness.
 * Runs once before all tests. Flow:
 *   1. Pre-flight: verify Supabase and Postgres are reachable
 *   2. Run migrations (idempotent — handles fresh checkout & post-merge)
 *   3. Fast-reset database (truncate + seed)
 *   4. Full reset fallback if fast-reset fails
 */
export default async function globalSetup(): Promise<void> {
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
        `  Run: ./pinpoint-wt.py sync`
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
        `  URL: ${postgresUrl.replace(/:[^:@]+@/, ":***@")}\n` +
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
