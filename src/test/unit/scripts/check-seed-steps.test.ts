// scripts/check-seed-steps.mjs is the drift guard for supabase/seed-steps.json.
// The real repo passing is proved by `pnpm run check:seed-steps`; these pin the failure
// modes, which are the point of the guard: a seed that exists but never runs
// leaves a table empty with no error (PP-tn6t, PP-o355.21, PP-wqit.12).

import { describe, expect, it } from "vitest";

import { findSeedDrift } from "../../../../scripts/check-seed-steps.mjs";

const steps = [
  { script: "db:_seed", minimal: true },
  { script: "db:_seed-users", minimal: true },
  { script: "db:_seed-tags" },
];

const consistent = {
  steps,
  scripts: {
    "db:reset": "npm-run-all db:_restart db:migrate db:_seed-all",
    "db:_seed-all": "node scripts/db-seed-all.mjs",
    "db:_seed": "psql",
    "db:_seed-users": "node users",
    "db:_seed-tags": "node tags",
  },
  ciAction:
    "run: |\n  pnpm run db:migrate\n  pnpm run db:_seed\n  pnpm run db:_seed-users\n",
  fastReset: "runSeedSteps();",
  globalSetup:
    "for (const step of seedSteps.steps) { if (!step.minimal) continue; }",
};

describe("findSeedDrift", () => {
  it("accepts a consistent set of owners", () => {
    expect(findSeedDrift(consistent)).toEqual([]);
  });

  it("flags a db:_seed script the list does not run", () => {
    const problems = findSeedDrift({
      ...consistent,
      scripts: { ...consistent.scripts, "db:_seed-opdb": "node opdb" },
    });
    expect(problems).toEqual([expect.stringContaining('"db:_seed-opdb"')]);
  });

  it("flags a step that is not a package script", () => {
    const problems = findSeedDrift({
      ...consistent,
      steps: [...steps, { script: "db:_seed-ghost" }],
    });
    expect(problems).toEqual([expect.stringContaining("db:_seed-ghost")]);
  });

  it("flags a db:reset that lists seeds by hand", () => {
    const problems = findSeedDrift({
      ...consistent,
      scripts: {
        ...consistent.scripts,
        "db:reset": "npm-run-all db:migrate db:_seed-all db:_seed-tags",
      },
    });
    expect(problems).toEqual([expect.stringContaining("db:_seed-tags")]);
  });

  it("flags fast-reset or global-setup growing its own list", () => {
    expect(
      findSeedDrift({
        ...consistent,
        globalSetup: `${consistent.globalSetup} pnpm run db:_seed-users`,
      })
    ).toEqual([expect.stringContaining("e2e/global-setup.ts")]);
    expect(findSeedDrift({ ...consistent, fastReset: "" })).toEqual([
      expect.stringContaining("runSeedSteps"),
    ]);
  });

  it("flags a CI action whose seeds are not the minimal subset", () => {
    const problems = findSeedDrift({
      ...consistent,
      ciAction: "run: |\n  pnpm run db:_seed\n",
    });
    expect(problems).toEqual([expect.stringContaining("setup-supabase")]);
  });
});
