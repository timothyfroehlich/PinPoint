// PP-d8l8 reproduction / regression harness — silent COMMIT loss over the
// Supabase Supavisor TRANSACTION pooler (:6543) with postgres-js prepared
// statements.
//
// Fires N concurrent transactions that mimic createIssue (counter UPDATE +
// issue INSERT) against a REAL Supavisor transaction pooler, then checks
// whether every transaction that RESOLVED (no error) actually persisted its
// row. The bug's signature is: the transaction resolves as committed, yet no
// row is durably present — resolved-count > persisted-count.
//
// This needs a real Supavisor pooler; local Supabase has one behind
// `[db.pooler]` (enable it, `pool_mode = "transaction"`). It is NOT wired into
// CI (CI has no Supavisor). Run on demand:
//
//   # against the local pooler (enable [db.pooler] first, supabase start)
//   PREPARE=true  node scripts/repro/pp-d8l8-commit-loss.mjs   # attempt repro
//   PREPARE=false node scripts/repro/pp-d8l8-commit-loss.mjs   # confirm the fix
//
// Env:
//   REPRO_POOLER_URL  full pooler URL (default: local Supavisor, tenant pooler-dev, :54929)
//   PREPARE           "true" | "false"  (default "true")
//   N                 concurrent transactions (default 16)

import postgres from "postgres";

const POOLER_URL =
  process.env.REPRO_POOLER_URL ??
  "postgresql://postgres.pooler-dev:postgres@localhost:54929/postgres";
const PREPARE = (process.env.PREPARE ?? "true") === "true";
const N = Number(process.env.N ?? 16);
const MACHINE = "ZZRP"; // matches ^[A-Z0-9]{2,6}$

const sql = postgres(POOLER_URL, { prepare: PREPARE, max: N, connect_timeout: 10 });

async function reset() {
  // Clean slate: remove the test machine (cascades to its issues), recreate at 1.
  await sql`DELETE FROM machines WHERE initials = ${MACHINE}`;
  await sql`INSERT INTO machines (initials, name, next_issue_number)
            VALUES (${MACHINE}, ${"PP-d8l8 repro"}, 1)`;
}

// One transaction that mirrors createIssue's write pattern: increment the
// per-machine counter, then insert the issue with the reserved number.
async function oneSubmit(i) {
  try {
    const issueNumber = await sql.begin(async (tx) => {
      const [m] = await tx`
        UPDATE machines SET next_issue_number = next_issue_number + 1
        WHERE initials = ${MACHINE}
        RETURNING next_issue_number`;
      const reserved = m.next_issue_number - 1;
      await tx`
        INSERT INTO issues (machine_initials, issue_number, title)
        VALUES (${MACHINE}, ${reserved}, ${`repro #${i}`})`;
      return reserved;
    });
    return { ok: true, issueNumber };
  } catch (e) {
    return { ok: false, error: e.message.split("\n")[0] };
  }
}

async function main() {
  console.log(
    `\nPP-d8l8 harness — prepare=${PREPARE} N=${N}\n  pooler=${POOLER_URL.replace(/:[^:@/]*@/, ":****@")}`,
  );
  await reset();

  // Fire all N concurrently to maximize contention on the counter row.
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) => oneSubmit(i)),
  );

  const resolved = results.filter((r) => r.ok);
  const rejected = results.filter((r) => !r.ok);

  // Ground truth: what actually persisted.
  const rows = await sql`
    SELECT issue_number FROM issues WHERE machine_initials = ${MACHINE}
    ORDER BY issue_number`;
  const persisted = rows.length;
  const numbers = rows.map((r) => r.issue_number);
  const [counter] =
    await sql`SELECT next_issue_number FROM machines WHERE initials = ${MACHINE}`;

  // Contiguity: reserved numbers run 1..resolved (machine starts at 1, each
  // txn reserves the pre-increment value), so persisted should be exactly that.
  const expected = Array.from({ length: resolved.length }, (_, i) => i + 1);
  const contiguous =
    numbers.length === expected.length &&
    numbers.every((v, i) => v === expected[i]);

  const lost = resolved.length - persisted;

  console.log(`  transactions resolved (no error): ${resolved.length}`);
  console.log(`  transactions rejected (error):    ${rejected.length}`);
  console.log(`  rows actually persisted:          ${persisted}`);
  console.log(`  machine counter advanced to:      ${counter.next_issue_number}`);
  console.log(`  issue numbers:                    [${numbers.join(", ")}]`);
  if (rejected.length) {
    const sample = [...new Set(rejected.map((r) => r.error))].slice(0, 3);
    console.log(`  sample errors:                    ${sample.join(" | ")}`);
  }

  let verdict;
  if (lost > 0) {
    verdict = `❌ SILENT COMMIT LOSS: ${lost} transaction(s) resolved as committed but no row persisted.`;
  } else if (!contiguous) {
    verdict = `⚠️  No silent loss, but issue numbers are not contiguous (gaps/dupes): persisted=${persisted}, resolved=${resolved.length}.`;
  } else {
    verdict = `✅ CLEAN: every resolved transaction persisted; ${persisted} contiguous issue numbers, no loss.`;
  }
  console.log(`\n  ${verdict}\n`);

  await sql`DELETE FROM machines WHERE initials = ${MACHINE}`;
  await sql.end();
  process.exit(lost > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("harness error:", e);
  process.exit(2);
});
