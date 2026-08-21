// ===== CORE-TS-007 enforcement teeth =====
//
// CORE-TS-007 (no `any`, no non-null `!`, no `no-unsafe-*`) is only a GATE
// because the rules that implement it cannot be switched off by a one-line
// comment. Under ESLint that guarantee came from
// `eslint-comments/no-restricted-disable` (`eslint.config.mjs`, PP-8k07).
// oxlint has no equivalent and oxc declined to add one (oxc-project/oxc#22193),
// recommending exactly this: a JS plugin that reads the comment stream.
//
// Two deliberate differences from the ESLint original:
//
//  1. **Both directive prefixes.** The original only understood `eslint-`.
//     After the oxlint cutover people will write `oxlint-disable`, and a rule
//     that ignored that prefix would be a gate with a hole in it. This one
//     matches `eslint-` and `oxlint-` alike, so it keeps working across the
//     cutover and in either engine.
//
//  2. **Blanket disables are banned outright.** The original restricted only
//     NAMED rules, which left `/* eslint-disable */` — a directive that turns
//     off every rule in the file, the restricted three included — as a legal
//     way around it. A rule list is required here.
//
// ── Who actually catches a blanket disable ──────────────────────────────────
// Not this rule, under oxlint. A blanket disable suppresses every JS-plugin
// diagnostic in the file INCLUDING the one this rule reports on the directive
// itself, so the `blanket` branch below cannot fire there — verified against
// oxlint 1.79. The enforcing rule is oxlint's native
// `unicorn/no-abusive-eslint-disable`, which the engine exempts from its own
// suppression and which covers `oxlint-disable` as well as `eslint-disable`;
// `.oxlintrc.json` enables it repo-wide (unscoped, unlike the named-rule ban
// below — a blanket disable in a test file would also hide
// `pinpoint/no-side-effects-in-transaction` and `better-tailwindcss`, neither
// of which is exempt there).
//
// The `blanket` branch stays anyway: it is correct under any engine that does
// not self-suppress, and it is the only coverage if the unicorn rule is ever
// dropped from the config.
//
// ── Why the rule names are matched prefix-agnostically ──────────────────────
// The same rule wears three names depending on who is reading the comment:
// `@typescript-eslint/no-explicit-any` (typescript-eslint), `typescript/no-explicit-any`
// (oxlint's plugin namespace), and bare `no-explicit-any`. All three must be
// caught, so the matchers anchor on the end of the name and accept any
// namespace, rather than enumerating prefixes that will change again.

/**
 * A disable directive of either engine, capturing everything after the
 * directive keyword (the rule list, then optionally `-- description`).
 *
 * Deliberately NOT matching `-enable`: re-enabling a rule is always safe, and
 * an `eslint-enable no-explicit-any` is the opposite of an escape hatch.
 */
const DISABLE_DIRECTIVE_RE =
  /^\s*(?:eslint|oxlint)-disable(?:-next-line|-line)?(?![\w-])([\s\S]*)$/;

/**
 * Restricted rule-name matchers, engine-prefix-agnostic. Exported so the
 * fixture test can assert on the same list the rule enforces rather than a
 * copy of it.
 */
export const RESTRICTED_DISABLE_PATTERNS = [
  /(?:^|\/)no-explicit-any$/,
  /(?:^|\/)no-non-null-assertion$/,
  /(?:^|\/)no-unsafe-[a-z-]+$/,
  // This rule itself. Without it, `// oxlint-disable-next-line
  // pinpoint/no-restricted-disable-directives` on the line ABOVE a restricted
  // directive silences the whole gate for one line — verified against oxlint
  // 1.79. Listing it here makes that comment report on its own line, which the
  // `-next-line` form does not cover. (A file-wide `/* oxlint-disable
  // pinpoint/no-restricted-disable-directives */` still wins, because it
  // suppresses the line it sits on; ESLint's `eslint-comments/no-restricted-disable`
  // has exactly the same hole, so this is parity, not a regression.)
  /(?:^|\/)no-restricted-disable-directives$/,
];

export const noRestrictedDisableDirectivesRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban disable comments for the CORE-TS-007 rules (any / non-null `!` / unsafe-*), and ban blanket disables that would turn them off wholesale",
    },
    schema: [],
    messages: {
      restricted:
        "'{{rule}}' must not be disabled by comment — CORE-TS-007 (any / non-null assertions / unsafe-*) is a gate, not a recommendation (PP-8k07).",
      blanket:
        "Blanket disable directives are forbidden: name the specific rules being disabled (and none of them may be a CORE-TS-007 rule).",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = DISABLE_DIRECTIVE_RE.exec(comment.value);
          if (!match) continue;

          // Everything before the `--` separator is the rule list; everything
          // after it is prose that may legitimately mention a rule name.
          const ruleList = (match[1] ?? "").split("--")[0]?.trim() ?? "";

          if (ruleList === "") {
            context.report({ loc: comment.loc, messageId: "blanket" });
            continue;
          }

          for (const rule of ruleList
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)) {
            if (RESTRICTED_DISABLE_PATTERNS.some((re) => re.test(rule))) {
              context.report({
                loc: comment.loc,
                messageId: "restricted",
                data: { rule },
              });
            }
          }
        }
      },
    };
  },
};

/**
 * Flat-config plugin object, merged into the `pinpoint` namespace by
 * `eslint-rules/pinpoint-plugin.mjs`.
 */
export const pinpointRestrictedDisablePlugin = {
  rules: {
    "no-restricted-disable-directives": noRestrictedDisableDirectivesRule,
  },
};
