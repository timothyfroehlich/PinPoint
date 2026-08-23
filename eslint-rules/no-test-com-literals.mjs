// ===== E2E anti-pattern: no hardcoded @test.com literals =====
//
// Static backstop for e2e tests discouraging hardcoded `@test.com` emails in
// favor of `TEST_USERS` constants.
//
// Replaces ESLint's `no-restricted-syntax` configuration in `eslint.config.mjs`
// block 5, which oxlint cannot evaluate with regex selector queries.
//
// Two node types:
//  1. String Literal containing `@test.com`
//  2. TemplateElement containing `@test.com` in its raw or cooked text

const TEST_COM_RE = /@test\.com/;

export const NO_TEST_COM_LITERAL_MESSAGE =
  "Use TEST_USERS constants instead of hardcoded @test.com emails (getTestEmail() args are a known false positive)";

export const NO_TEST_COM_TEMPLATE_MESSAGE =
  "Use TEST_USERS constants instead of hardcoded @test.com emails";

/**
 * @type {import("eslint").Rule.RuleModule}
 */
export const noTestComLiteralsRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow hardcoded @test.com email literals in e2e tests in favor of TEST_USERS constants",
    },
    schema: [],
    messages: {
      literal: NO_TEST_COM_LITERAL_MESSAGE,
      template: NO_TEST_COM_TEMPLATE_MESSAGE,
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === "string" && TEST_COM_RE.test(node.value)) {
          context.report({ node, messageId: "literal" });
        }
      },
      TemplateElement(node) {
        const raw = node.value?.raw ?? "";
        const cooked = node.value?.cooked ?? "";
        if (TEST_COM_RE.test(raw) || TEST_COM_RE.test(cooked)) {
          context.report({ node, messageId: "template" });
        }
      },
    };
  },
};

/**
 * Flat-config plugin object, merged into the `pinpoint` namespace by
 * `eslint-rules/pinpoint-plugin.mjs`.
 */
export const pinpointNoTestComLiteralsPlugin = {
  rules: {
    "no-test-com-literals": noTestComLiteralsRule,
  },
};
