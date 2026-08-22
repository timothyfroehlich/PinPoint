import { Linter } from "eslint";
import typescriptParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";

import {
  pinpointNoTestComLiteralsPlugin,
  NO_TEST_COM_LITERAL_MESSAGE,
  NO_TEST_COM_TEMPLATE_MESSAGE,
} from "../../../eslint-rules/no-test-com-literals.mjs";

const RULE_ID = "pinpoint/no-test-com-literals";
const linter = new Linter();

function lint(code: string): Linter.LintMessage[] {
  return linter.verify(code, {
    plugins: { pinpoint: pinpointNoTestComLiteralsPlugin },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    rules: {
      [RULE_ID]: "warn",
    },
  });
}

function violations(code: string): Linter.LintMessage[] {
  const messages = lint(code);
  const fatal = messages.find((m) => m.fatal);
  expect(fatal, fatal?.message).toBeUndefined();
  return messages.filter((m) => m.ruleId === RULE_ID);
}

describe("pinpoint/no-test-com-literals", () => {
  it("FIRES on a string literal containing @test.com", () => {
    const code = `const email = "user@test.com";`;
    const found = violations(code);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe(NO_TEST_COM_LITERAL_MESSAGE);
  });

  it("FIRES on a template literal containing @test.com", () => {
    const code = "const email = `user-${123}@test.com`;";
    const found = violations(code);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe(NO_TEST_COM_TEMPLATE_MESSAGE);
  });

  it("stays silent on non-@test.com literals and constants", () => {
    const code = `
      const email = "user@example.com";
      const template = \`user-\${123}@pinpoint.local\`;
      const constant = TEST_USERS.admin.email;
    `;
    expect(violations(code)).toHaveLength(0);
  });
});
