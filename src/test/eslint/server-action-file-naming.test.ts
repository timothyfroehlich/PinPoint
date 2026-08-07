import { Linter } from "eslint";
import typescriptParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";

import {
  isConformingActionFilename,
  pinpointServerActionNamingPlugin,
} from "../../../eslint-rules/server-action-file-naming.mjs";

/**
 * Server Action file naming.
 *
 * Exercises the SAME custom rule the production `eslint.config.mjs` registers
 * (imported from the shared module), but with a syntax-only flat config — no
 * `parserOptions.project` — so fixtures need not be members of any tsconfig.
 * The rule is purely syntactic, so this faithfully exercises it.
 *
 * The rule exists because the `.claude/rules/` `paths:` globs that route the
 * Server Action rules to action files match on FILENAME, while "is this an
 * action module?" is answered by a directive. This test is what proves the two
 * still agree.
 */

const RULE_ID = "pinpoint/server-action-file-naming";
const linter = new Linter();

function violations(code: string, filename: string): Linter.LintMessage[] {
  const messages = linter.verify(
    code,
    {
      // Two things this harness needs that the sibling transaction-rule test
      // does not, both because this rule is filename-driven:
      //  1. `files` — a flat-config block with none matches only ESLint's
      //     default `**/*.{js,mjs,cjs}`, so every `.ts` fixture would lint to
      //     zero messages and every assertion below would pass vacuously.
      //  2. Fixture paths must be repo-RELATIVE. Flat config resolves `files`
      //     against the config basePath (cwd); an absolute `/repo/...` path
      //     lands outside it and ESLint returns "No matching configuration
      //     found" instead of linting.
      files: ["**/*.ts", "**/*.tsx"],
      plugins: { pinpoint: pinpointServerActionNamingPlugin },
      languageOptions: {
        parser: typescriptParser,
        parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      },
      rules: { [RULE_ID]: "error" },
    },
    filename
  );
  // Surface any genuine parse error rather than silently passing.
  const fatal = messages.find((m) => m.fatal);
  expect(fatal, fatal?.message).toBeUndefined();
  return messages.filter((m) => m.ruleId === RULE_ID);
}

const USE_SERVER_MODULE = `"use server";

import { db } from "~/server/db";

export async function doThing(): Promise<void> {
  await db.select();
}
`;

describe("Server Action file naming", () => {
  it('FIRES on a module-level "use server" file with an off-pattern name', () => {
    const found = violations(
      USE_SERVER_MODULE,
      "src/app/(app)/issues/mutations.ts"
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("actions.ts");
  });

  it.each([
    ["src/app/(app)/issues/actions.ts", "bare actions.ts"],
    ["src/app/(app)/issues/watcher-actions.ts", "plural suffix"],
    ["src/app/(app)/issues/export-action.ts", "singular suffix"],
    ["src/app/(auth)/oauth-actions.ts", "hyphenated prefix"],
    ["src/components/issues/issue-actions.tsx", ".tsx"],
    ["src/server/actions/avatar.ts", "shared actions dir, any basename"],
  ])("stays silent on %s (%s)", (filename) => {
    expect(violations(USE_SERVER_MODULE, filename)).toHaveLength(0);
  });

  it('stays silent on an off-pattern file with NO "use server" directive', () => {
    const code = `import { db } from "~/server/db";

export async function doThing(): Promise<void> {
  await db.select();
}
`;
    expect(violations(code, "src/app/(app)/issues/mutations.ts")).toHaveLength(
      0
    );
  });

  it('stays silent when "use server" is only a function-body directive', () => {
    // Inline server actions are a different construct (CORE-ARCH-005 territory)
    // and do not make the whole module an action module.
    const code = `export function Form(): null {
  async function submit(): Promise<void> {
    "use server";
    await Promise.resolve();
  }
  void submit;
  return null;
}
`;
    expect(
      violations(code, "src/components/issues/issue-form.tsx")
    ).toHaveLength(0);
  });

  it('stays silent when "use server" appears only in a comment or string', () => {
    // Three files under src/app/(auth) mention the directive in prose; none is
    // an action module.
    const code = `/**
 * Separated from actions.ts because "use server" files can only export
 * async functions, not objects.
 */
export const marker = "use server";
`;
    expect(violations(code, "src/app/(auth)/schemas.ts")).toHaveLength(0);
  });

  it("matches on basename, not on the directory it sits in", () => {
    // The rule constrains what an action module is CALLED, never where it
    // lives — colocating a route action or hoisting it is a free choice.
    expect(
      violations(USE_SERVER_MODULE, "src/lib/pinballmap/actions.ts")
    ).toHaveLength(0);
    expect(
      violations(USE_SERVER_MODULE, "src/server/mutations.ts")
    ).toHaveLength(1);
  });

  describe("isConformingActionFilename", () => {
    it.each([
      "actions.ts",
      "actions.tsx",
      "watcher-actions.ts",
      "export-action.ts",
      "test-discord-dm-action.ts",
      "src/server/actions/images.ts",
      "src\\server\\actions\\images.ts",
    ])("accepts %s", (filename) => {
      expect(isConformingActionFilename(filename)).toBe(true);
    });

    it.each([
      "mutations.ts",
      "action.md",
      "actions.js",
      "reactions.ts",
      "src/server/actionable/thing.ts",
    ])("rejects %s", (filename) => {
      expect(isConformingActionFilename(filename)).toBe(false);
    });
  });
});
