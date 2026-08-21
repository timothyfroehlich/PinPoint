import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

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
