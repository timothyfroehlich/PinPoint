#!/usr/bin/env node
/**
 * Weekly chores check: attest that PinPoint-Prod's Supabase daily physical
 * backups still exist and that retention is intact.
 *
 * Background: our disaster-recovery posture is "Supabase Pro takes daily
 * backups with 7-day retention" (AGENTS.md "Supabase", bead PinPoint-dka). Nothing
 * ever verified that claim, so a silently-failing backup job or a retention
 * change would only surface during a restore. This script is that verification.
 *
 * SCOPE: this attests that backups EXIST and are being RETAINED. It does not
 * prove they RESTORE — a real restore drill means restoring a physical backup
 * into a throwaway project, which is not a weekly-cadence activity.
 *
 * NOT a `pnpm run check` / preflight / CI gate: it hits the network and the
 * prod Management API. Chores-session only.
 *
 * Auth comes from the Supabase CLI's stored token (macOS keychain), which is
 * why this shells out to the CLI rather than calling the Management API with
 * a SUPABASE_ACCESS_TOKEN — there isn't one in the environment.
 *
 * Usage: pnpm run chores:backups
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** PinPoint-Prod. Same hardcoded ref as scripts/backup-production.sh. */
const PROD_REF = "udhesuizjsgxfeotqybn";

/** Documented retention (AGENTS.md "Supabase"): 7 daily backups. */
const EXPECTED_RETENTION = 7;

/** Newest backup older than this warns (a day was likely skipped). */
const STALE_WARN_HOURS = 24;

/** Newest backup older than this fails (the daily job is broken). */
const STALE_FAIL_HOURS = 48;

/** Gap between consecutive backups that indicates a missed day. */
const GAP_WARN_HOURS = 36;

const CLI_TIMEOUT_MS = 60_000;

const HOUR_MS = 3_600_000;

/**
 * Pure evaluation of a `supabase backups list --output json` payload.
 * Exported so the assertion branches can be exercised without network access.
 *
 * @param {unknown} payload parsed CLI JSON
 * @param {Date} now
 * @returns {{status: "PASS"|"FAIL", failures: string[], warnings: string[], info: string[]}}
 */
export function evaluate(payload, now) {
  /** @type {string[]} */ const failures = [];
  /** @type {string[]} */ const warnings = [];
  /** @type {string[]} */ const info = [];

  const region =
    typeof payload?.region === "string" ? payload.region : "unknown";
  info.push(`region: ${region}`);

  // WAL-G is what actually produces the physical backups. If it's off, the
  // whole posture is gone regardless of what's still listed from before.
  if (payload?.walg_enabled !== true) {
    failures.push(
      `walg_enabled is ${JSON.stringify(payload?.walg_enabled)} (expected true) — physical backups are not being taken.`
    );
  }

  // Reported, not asserted: PITR is a posture decision, but a change to it
  // should be visible in the weekly output rather than silently drift.
  info.push(
    `pitr_enabled: ${payload?.pitr_enabled === true} — recovery floor is the newest daily snapshot unless this is true`
  );

  const backups = Array.isArray(payload?.backups) ? payload.backups : [];
  if (backups.length === 0) {
    failures.push("Supabase reported zero backups for this project.");
    return { status: "FAIL", failures, warnings, info };
  }

  info.push(`${backups.length} backup(s) reported`);

  for (const backup of backups) {
    if (backup?.status !== "COMPLETED") {
      warnings.push(
        `backup ${backup?.id ?? "<no id>"} (${backup?.inserted_at ?? "<no timestamp>"}) has status ${JSON.stringify(backup?.status)}, not COMPLETED.`
      );
    }
  }

  const completed = backups
    .filter((backup) => backup?.status === "COMPLETED")
    .map((backup) => ({ id: backup.id, at: new Date(backup.inserted_at) }));

  const undated = completed.filter((backup) =>
    Number.isNaN(backup.at.getTime())
  );
  if (undated.length > 0) {
    failures.push(
      `${undated.length} COMPLETED backup(s) have an unparseable inserted_at — cannot evaluate freshness.`
    );
    return { status: "FAIL", failures, warnings, info };
  }

  if (completed.length === 0) {
    failures.push(
      "No COMPLETED backups — every listed backup is in a failed or pending state."
    );
    return { status: "FAIL", failures, warnings, info };
  }

  completed.sort((a, b) => b.at.getTime() - a.at.getTime());

  const newest = completed[0];
  const ageHours = (now.getTime() - newest.at.getTime()) / HOUR_MS;
  info.push(
    `newest COMPLETED backup: ${newest.at.toISOString()} (${ageHours.toFixed(1)}h old)`
  );

  if (ageHours > STALE_FAIL_HOURS) {
    failures.push(
      `Newest COMPLETED backup is ${ageHours.toFixed(1)}h old (>${STALE_FAIL_HOURS}h) — the daily backup job has stopped.`
    );
  } else if (ageHours > STALE_WARN_HOURS) {
    warnings.push(
      `Newest COMPLETED backup is ${ageHours.toFixed(1)}h old (>${STALE_WARN_HOURS}h) — a daily run was likely skipped.`
    );
  }

  if (completed.length < EXPECTED_RETENTION) {
    failures.push(
      `Only ${completed.length} COMPLETED backup(s) retained, expected at least ${EXPECTED_RETENTION} — retention has shrunk or the project was downgraded.`
    );
  }

  // A run of recent backups can mask a hole further back in the window.
  for (let i = 0; i < completed.length - 1; i++) {
    const gapHours =
      (completed[i].at.getTime() - completed[i + 1].at.getTime()) / HOUR_MS;
    if (gapHours > GAP_WARN_HOURS) {
      warnings.push(
        `${gapHours.toFixed(1)}h gap between ${completed[i + 1].at.toISOString()} and ${completed[i].at.toISOString()} — a day was missed inside the retention window.`
      );
    }
  }

  return {
    status: failures.length > 0 ? "FAIL" : "PASS",
    failures,
    warnings,
    info,
  };
}

/**
 * Invoke the Supabase CLI and parse its JSON.
 * `--output json` is load-bearing: the CLI's agent auto-detection emits JSON
 * when it thinks an agent is calling, but a plain human TTY gets an ANSI table.
 */
function fetchBackups() {
  let stdout;
  try {
    stdout = execFileSync(
      "supabase",
      ["backups", "list", "--project-ref", PROD_REF, "--output", "json"],
      {
        encoding: "utf8",
        timeout: CLI_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "The `supabase` CLI is not on PATH. Install it, then re-run.",
        { cause: error }
      );
    }
    if (error.code === "ETIMEDOUT") {
      throw new Error(
        `\`supabase backups list\` timed out after ${CLI_TIMEOUT_MS / 1000}s.`,
        { cause: error }
      );
    }
    const stderr = String(error.stderr ?? "");
    if (/access token|not logged in|unauthor/i.test(stderr)) {
      throw new Error(
        `Supabase CLI is not authenticated — run \`supabase login\`.\n${stderr.trim()}`,
        { cause: error }
      );
    }
    throw new Error(
      `\`supabase backups list\` failed.\n${stderr.trim() || error.message}`,
      { cause: error }
    );
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Could not parse CLI output as JSON — did \`--output json\` stop being honored?\n${stdout.slice(0, 400)}`,
      { cause: error }
    );
  }
}

function main() {
  console.log(
    `Checking Supabase physical backups for ${PROD_REF} (PinPoint-Prod)...\n`
  );

  let result;
  try {
    result = evaluate(fetchBackups(), new Date());
  } catch (error) {
    console.error(`FAIL — ${error.message}`);
    process.exit(1);
  }

  for (const line of result.info) console.log(`  ${line}`);

  if (result.warnings.length > 0) {
    console.log("\nWARNINGS:");
    for (const warning of result.warnings) console.log(`  ! ${warning}`);
  }

  if (result.failures.length > 0) {
    console.log("\nFAILURES:");
    for (const failure of result.failures) console.log(`  x ${failure}`);
    console.log(
      "\nFAIL — check the Supabase dashboard and status page before assuming this script is wrong, then file a P1 bead."
    );
    process.exit(1);
  }

  console.log(
    `\nPASS — daily physical backups exist and retention is intact.${result.warnings.length > 0 ? " (with warnings, above)" : ""}`
  );
  console.log("Note: this attests existence + retention, not restorability.");
}

// Only run when invoked directly, so `evaluate` can be imported for checks.
// pathToFileURL (not a hand-built `file://` string) because any path segment
// needing URL-encoding — a space, a non-ASCII char — would make the comparison
// silently false, and a verification script that quietly no-ops and exits 0 is
// worse than one that crashes.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
