import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * The ordered seed list for a local database, read from
 * supabase/seed-steps.json. `db:reset` (via `db:_seed-all`) and
 * `db:fast-reset` both run all of it; the e2e global-setup fallback runs the
 * entries marked `minimal`. scripts/check-seed-steps.mjs keeps package.json,
 * the CI setup action and global-setup honest against this file.
 *
 * @typedef {{ script: string, note: string, minimal?: boolean }} SeedStep
 */

const SEED_STEPS_PATH = new URL(
  "../../supabase/seed-steps.json",
  import.meta.url
);

/** @returns {SeedStep[]} */
export function loadSeedSteps() {
  return JSON.parse(readFileSync(SEED_STEPS_PATH, "utf8")).steps;
}

/**
 * Run every seed step in order, stopping at the first failure (execFileSync
 * throws). No shell: each step is one argv entry.
 */
export function runSeedSteps() {
  for (const { script } of loadSeedSteps()) {
    execFileSync("pnpm", ["run", script], { stdio: "inherit" });
  }
}
