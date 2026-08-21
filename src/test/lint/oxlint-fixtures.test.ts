import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { RESTRICTED_DISABLE_PATTERNS } from "../../../eslint-rules/no-restricted-disable-directives.mjs";

/**
 * Fixture harness for the rules oxlint runs through its JS-plugin API
 * (`jsPlugins` in `.oxlintrc.json`).
 *
 * Those rules cannot be exercised the way `src/test/eslint/*.test.ts` exercises
 * the same rule objects — ESLint's `Linter` runs the rule in-process, which
 * proves the rule's LOGIC but says nothing about whether oxlint loads it,
 * resolves its options, or scopes it correctly. That wiring is the thing most
 * likely to break silently (a plugin that fails to load reports nothing, which
 * is indistinguishable from a clean tree), so this harness shells out to the
 * real binary over real files and asserts on the diagnostics it emits.
 *
 * The fixtures live in `eslint-rules/__fixtures__/` rather than next to this
 * file: every lint script in the repo runs over `src/ e2e/ scripts/`, so a
 * deliberately-violating fixture inside `src/` would fail `pnpm run lint`.
 */

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

const OXLINT_BIN = path.join(REPO_ROOT, "node_modules/.bin/oxlint");

export const FIXTURE_DIR = "eslint-rules/__fixtures__";

/** One oxlint diagnostic, flattened to the fields a fixture assertion needs. */
export interface OxlintFinding {
  /** Normalized to config form: `plugin/rule` (oxlint prints `plugin(rule)`). */
  ruleId: string;
  /** Path relative to the repo root, as oxlint reports it. */
  file: string;
  line: number;
  column: number;
  message: string;
  severity: string;
}

interface OxlintJsonDiagnostic {
  message: string;
  code: string;
  severity: string;
  filename: string;
  labels?: { span: { line: number; column: number } }[];
}

/**
 * Run oxlint over a fixture directory and return its diagnostics.
 *
 * `fixtureDir` is relative to the repo root and must contain its own
 * `.oxlintrc.json` (passed explicitly with `--config`, which also disables
 * oxlint's nested-config discovery so the run is deterministic).
 *
 * Phase 3 of the oxlint-only migration reuses this helper for the directive
 * rules, so it deliberately returns raw findings rather than asserting.
 */
export async function runOxlint(
  fixtureDir: string = FIXTURE_DIR
): Promise<OxlintFinding[]> {
  const configPath = path.posix.join(fixtureDir, ".oxlintrc.json");

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      OXLINT_BIN,
      [
        "--format",
        "json",
        // oxlint fans out over every core by default. This runs inside a
        // parallel vitest pool that is already saturating the host, and a
        // fixture directory is a handful of tiny files, so the fan-out buys
        // nothing and costs the pool its workers.
        "--threads",
        "1",
        "--config",
        configPath,
        fixtureDir,
      ],
      { cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 }
    ));
  } catch (error) {
    // oxlint exits non-zero whenever it reports an error-severity diagnostic,
    // which is the expected state for a violation fixture. Its JSON still went
    // to stdout, so recover it; only a genuine launch failure has none.
    const failure = error as { stdout?: string; stderr?: string };
    if (failure.stdout === undefined || failure.stdout === "") throw error;
    stdout = failure.stdout;
  }

  const parsed = JSON.parse(stdout) as { diagnostics?: OxlintJsonDiagnostic[] };

  return (parsed.diagnostics ?? []).map((d) => {
    const span = d.labels?.[0]?.span;
    return {
      ruleId: d.code.replace(/^([^(]+)\((.+)\)$/, "$1/$2"),
      file: d.filename,
      line: span?.line ?? 0,
      column: span?.column ?? 0,
      message: d.message,
      severity: d.severity,
    };
  });
}

/** Findings for one fixture file, in source order. */
function forFile(findings: OxlintFinding[], basename: string): OxlintFinding[] {
  return findings
    .filter((f) => path.basename(f.file) === basename)
    .sort((a, b) => a.line - b.line || a.column - b.column);
}

describe("oxlint jsPlugins fixtures", () => {
  // One oxlint process for the whole suite — the binary is fast but process
  // startup is not, and every assertion reads the same diagnostic set.
  const findingsPromise = runOxlint();

  it("loads every jsPlugin rule (a plugin that fails to load reports nothing)", async () => {
    const findings = await findingsPromise;
    expect(new Set(findings.map((f) => f.ruleId))).toEqual(
      new Set([
        "pinpoint/no-side-effects-in-transaction",
        "pinpoint/server-action-file-naming",
        "pinpoint/no-restricted-disable-directives",
        "pinpoint/require-directive-description",
        // Native, not a jsPlugin — but it is the rule that actually enforces
        // the blanket-disable ban (see the directive-governance block below),
        // so a config that lost it should fail here too.
        "unicorn/no-abusive-eslint-disable",
        "better-tailwindcss/no-restricted-classes",
      ])
    );
  });

  it("fires pinpoint/no-side-effects-in-transaction inside a db.transaction callback", async () => {
    const found = forFile(await findingsPromise, "tx-side-effect.ts");
    expect(
      found.map((f) => ({ ruleId: f.ruleId, line: f.line }))
    ).toStrictEqual([
      // the bare `fetch(...)`
      { ruleId: "pinpoint/no-side-effects-in-transaction", line: 11 },
      // the `sendEmail(...)` helper
      { ruleId: "pinpoint/no-side-effects-in-transaction", line: 12 },
    ]);
    expect(found[0]?.message).toContain("CORE-ARCH-011");
  });

  it("fires pinpoint/server-action-file-naming on an off-pattern action module", async () => {
    const found = forFile(await findingsPromise, "not-an-action-file.ts");
    expect(
      found.map((f) => ({ ruleId: f.ruleId, line: f.line }))
    ).toStrictEqual([
      { ruleId: "pinpoint/server-action-file-naming", line: 4 },
    ]);
  });

  it("fires better-tailwindcss/no-restricted-classes on raw palette and hex classes", async () => {
    const found = forFile(await findingsPromise, "palette.tsx");
    expect(
      found.map((f) => ({ ruleId: f.ruleId, line: f.line }))
    ).toStrictEqual([
      { ruleId: "better-tailwindcss/no-restricted-classes", line: 6 },
      { ruleId: "better-tailwindcss/no-restricted-classes", line: 7 },
    ]);
    // Both `restrict` patterns must be live, not just the first.
    expect(found[0]?.message).toContain("Raw Tailwind palette classes");
    expect(found[1]?.message).toContain("Hardcoded arbitrary hex values");
  });

  it("stays silent on the conforming fixtures", async () => {
    const findings = await findingsPromise;
    expect(forFile(findings, "clean-actions.ts")).toStrictEqual([]);
    expect(forFile(findings, "clean-tokens.tsx")).toStrictEqual([]);
  });
});

/**
 * Directive governance — the CORE-TS-007 enforcement teeth (PP-8k07).
 *
 * These are the rules that make CORE-TS-007 a gate rather than a
 * recommendation, and Phase 4 of the oxlint-only migration deletes ESLint (and
 * with it `eslint-comments/no-restricted-disable` and
 * `eslint-comments/require-description`) on the strength of them. So they get
 * asserted case by case rather than in aggregate: a regression here is a
 * silently open door to `any`, not a lint nit.
 */
describe("oxlint directive governance", () => {
  const findingsPromise = runOxlint();

  it("bans a restricted disable under every prefix and namespace it can wear", async () => {
    const found = forFile(await findingsPromise, "restricted-disable.ts");
    expect(
      found.map((f) => ({ ruleId: f.ruleId, line: f.line }))
    ).toStrictEqual([
      // `oxlint-` prefix, oxlint's own `typescript/` namespace
      { ruleId: "pinpoint/no-restricted-disable-directives", line: 7 },
      // `eslint-` prefix, typescript-eslint's `@typescript-eslint/` namespace
      { ruleId: "pinpoint/no-restricted-disable-directives", line: 10 },
      // bare rule name, `no-unsafe-*` family
      { ruleId: "pinpoint/no-restricted-disable-directives", line: 13 },
      // restricted rule hiding in a comma-separated list
      { ruleId: "pinpoint/no-restricted-disable-directives", line: 16 },
      // disabling this rule to smuggle the next line past it
      { ruleId: "pinpoint/no-restricted-disable-directives", line: 31 },
    ]);
    expect(found[0]?.message).toContain("CORE-TS-007");
  });

  it("exercises every pattern the rule actually enforces", async () => {
    // Guards the list against growing a pattern with no fixture behind it: the
    // rule's own export is the source of truth, not a copy in this file.
    const reportedNames = forFile(
      await findingsPromise,
      "restricted-disable.ts"
    ).map((f) => /'([^']+)'/.exec(f.message)?.[1] ?? "");

    for (const pattern of RESTRICTED_DISABLE_PATTERNS) {
      expect(
        reportedNames.some((name) => pattern.test(name)),
        `no fixture case covers ${pattern.source}`
      ).toBe(true);
    }
  });

  it("bans a blanket disable via the native rule (a jsPlugin cannot see one)", async () => {
    // A blanket disable suppresses every jsPlugin diagnostic in the file,
    // including the one `pinpoint/no-restricted-disable-directives` would
    // report on the directive itself. `unicorn/no-abusive-eslint-disable` is
    // exempt from that suppression, which is why it is the enforcing rule and
    // why this assertion names it.
    expect(
      forFile(await findingsPromise, "blanket-disable.ts").map((f) => ({
        ruleId: f.ruleId,
        line: f.line,
      }))
    ).toStrictEqual([{ ruleId: "unicorn/no-abusive-eslint-disable", line: 1 }]);
  });

  it("requires a `-- reason` on directives of either prefix", async () => {
    const found = forFile(await findingsPromise, "undescribed-directive.ts");
    expect(
      found.map((f) => ({ ruleId: f.ruleId, line: f.line }))
    ).toStrictEqual([
      { ruleId: "pinpoint/require-directive-description", line: 6 }, // oxlint-
      { ruleId: "pinpoint/require-directive-description", line: 9 }, // eslint-
      { ruleId: "pinpoint/require-directive-description", line: 13 }, // bare `--`
      // line 16 carries a real description and must not appear.
    ]);
  });
});
