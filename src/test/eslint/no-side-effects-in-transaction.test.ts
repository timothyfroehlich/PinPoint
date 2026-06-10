import { Linter } from "eslint";
// @ts-expect-error -- type-only parser import has no bundled declarations here
import typescriptParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";

import {
  noSideEffectsInTransactionOptions,
  SIDE_EFFECT_CALLEES,
} from "../../../eslint-rules/no-side-effects-in-transaction.mjs";

/**
 * CORE-ARCH-011 static backstop (PP-2053.13).
 *
 * Lints fixtures against the SAME `no-restricted-syntax` options the production
 * `eslint.config.mjs` uses (imported from the shared module), but with a
 * syntax-only flat config — no `parserOptions.project` — so fixtures need not be
 * members of any tsconfig. The rule is purely syntactic, so this faithfully
 * exercises it.
 */

const linter = new Linter();

function lint(code: string): Linter.LintMessage[] {
  return linter.verify(code, {
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    rules: {
      "no-restricted-syntax": ["error", ...noSideEffectsInTransactionOptions],
    },
  });
}

function violations(code: string): Linter.LintMessage[] {
  const messages = lint(code);
  // Surface any genuine parse error rather than silently passing.
  const fatal = messages.find((m) => m.fatal);
  expect(fatal, fatal?.message).toBeUndefined();
  return messages.filter((m) => m.ruleId === "no-restricted-syntax");
}

describe("no external side effects inside db.transaction (CORE-ARCH-011)", () => {
  it("FIRES on sendEmail called inside a db.transaction arrow callback", () => {
    const code = `
      async function createIssue() {
        return await db.transaction(async (tx) => {
          await tx.insert(issues).values({});
          await sendEmail({ to: "x@example.com" });
        });
      }
    `;
    const found = violations(code);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("CORE-ARCH-011");
  });

  it("FIRES on every banned side-effect helper inside a transaction", () => {
    // One call per banned identifier, all inside the same transaction callback.
    const calls = SIDE_EFFECT_CALLEES.map((name) => `await ${name}();`).join(
      "\n          "
    );
    const code = `
      async function run() {
        await db.transaction(async (tx) => {
          ${calls}
        });
      }
    `;
    expect(violations(code)).toHaveLength(SIDE_EFFECT_CALLEES.length);
  });

  it("FIRES on direct Resend client usage (resend.emails.send) inside a transaction", () => {
    const code = `
      async function run() {
        await db.transaction(async (tx) => {
          await resend.emails.send({ to: "x" });
        });
      }
    `;
    expect(violations(code)).toHaveLength(1);
  });

  it("FIRES inside a function-expression transaction callback too", () => {
    const code = `
      async function run() {
        await db.transaction(async function (tx) {
          await dispatchNotification(plan);
        });
      }
    `;
    expect(violations(code)).toHaveLength(1);
  });

  it("does NOT fire on the correct pattern: side effects before/after the transaction", () => {
    const code = `
      async function createIssue() {
        // pre-transaction fetch of inputs (correct)
        const channels = await getDiscordConfig();
        const issue = await db.transaction(async (tx) => {
          return await tx.insert(issues).values({}).returning();
        });
        // post-commit dispatch (correct)
        await dispatchNotification(plan);
        await sendEmail({ to: "x@example.com" });
        await resend.emails.send({ to: "x" });
        await fetch("https://example.com");
        return issue;
      }
    `;
    expect(violations(code)).toHaveLength(0);
  });

  it("does NOT fire on pure DB work inside a transaction", () => {
    const code = `
      async function run() {
        await db.transaction(async (tx) => {
          await tx.update(machines).set({ x: 1 });
          await tx.insert(issues).values({});
        });
      }
    `;
    expect(violations(code)).toHaveLength(0);
  });
});
