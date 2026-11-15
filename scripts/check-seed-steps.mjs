#!/usr/bin/env node
/**
 * Fails when a place that seeds the local database stops matching
 * supabase/seed-steps.json, the one ordered owner of the seed list.
 *
 * The list used to be hand-copied into package.json's `db:reset` chain,
 * scripts/db-fast-reset.mjs and e2e/global-setup.ts, and the copies drifted
 * three times (PP-tn6t, PP-o355.21, PP-wqit.12): a seed missing from one place
 * left a table silently empty with no error. Now `db:reset` and `db:fast-reset`
 * both run the JSON list, so they cannot drift by construction. What remains to
 * guard is the code that could grow its own list again:
 *
 *   - every step names a package.json script, once;
 *   - every `db:_seed*` package script is in the list (a new seed that was
 *     added to package.json but not the list would never run);
 *   - `db:reset` seeds only through `db:_seed-all`;
 *   - db-fast-reset.mjs and global-setup.ts name no seed script themselves;
 *   - the CI setup action's seeds are the `minimal` subset, in order.
 *
 * Usage: pnpm run check:seed-steps
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SEED_ALL = "db:_seed-all";
const SEED_SCRIPT = /^db:_seed(?:-|$)/;
const SEED_REFERENCE = /db:_seed(?:-[a-z-]+)?/g;

/**
 * @param {{
 *   steps: { script: string, minimal?: boolean }[],
 *   scripts: Record<string, string>,
 *   ciAction: string,
 *   fastReset: string,
 *   globalSetup: string,
 * }} input
 * @returns {string[]} one message per problem; empty when everything matches
 */
export function findSeedDrift({
  steps,
  scripts,
  ciAction,
  fastReset,
  globalSetup,
}) {
  const problems = [];
  const listed = steps.map((step) => step.script);

  for (const script of listed) {
    if (!(script in scripts)) {
      problems.push(
        `seed-steps.json lists "${script}", which is not a package.json script`
      );
    }
    if (listed.indexOf(script) !== listed.lastIndexOf(script)) {
      problems.push(`seed-steps.json lists "${script}" more than once`);
    }
  }

  for (const script of Object.keys(scripts)) {
    if (SEED_SCRIPT.test(script) && script !== SEED_ALL) {
      if (!listed.includes(script)) {
        problems.push(
          `package.json defines "${script}" but seed-steps.json does not list it, so db:reset and db:fast-reset never run it`
        );
      }
    }
  }

  const reset = scripts["db:reset"] ?? "";
  if (!reset.split(/\s+/).includes(SEED_ALL)) {
    problems.push(`package.json "db:reset" does not run ${SEED_ALL}`);
  }
  const hand = reset.match(SEED_REFERENCE)?.filter((s) => s !== SEED_ALL);
  if (hand?.length) {
    problems.push(
      `package.json "db:reset" names ${hand.join(", ")} itself; seeds belong in seed-steps.json`
    );
  }

  if (!/runSeedSteps\(/.test(fastReset)) {
    problems.push("scripts/db-fast-reset.mjs does not call runSeedSteps()");
  }
  for (const [file, source] of [
    ["scripts/db-fast-reset.mjs", fastReset],
    ["e2e/global-setup.ts", globalSetup],
  ]) {
    const named = source.match(SEED_REFERENCE);
    if (named) {
      problems.push(
        `${file} names ${[...new Set(named)].join(", ")} itself; seeds belong in seed-steps.json`
      );
    }
  }
  if (!/steps\b[\s\S]*\.minimal/.test(globalSetup)) {
    problems.push("e2e/global-setup.ts does not read the minimal seed steps");
  }

  const minimal = steps.filter((step) => step.minimal).map((s) => s.script);
  const ciSeeds = [
    ...ciAction.matchAll(/pnpm run (db:_seed(?:-[a-z-]+)?)\s*$/gm),
  ]
    .map((match) => match[1])
    .filter((script) => script !== undefined);
  if (JSON.stringify(ciSeeds) !== JSON.stringify(minimal)) {
    problems.push(
      `.github/actions/setup-supabase/action.yml seeds [${ciSeeds.join(", ")}] but the minimal steps are [${minimal.join(", ")}]`
    );
  }

  return problems;
}

function main() {
  const read = (path) => readFileSync(path, "utf8");
  const problems = findSeedDrift({
    steps: JSON.parse(read("supabase/seed-steps.json")).steps,
    scripts: JSON.parse(read("package.json")).scripts,
    ciAction: read(".github/actions/setup-supabase/action.yml"),
    fastReset: read("scripts/db-fast-reset.mjs"),
    globalSetup: read("e2e/global-setup.ts"),
  });
  if (problems.length === 0) return;
  console.error("Seed list drift (owner: supabase/seed-steps.json):");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
