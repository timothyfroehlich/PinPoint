// ===== CORE-TS-007 enforcement teeth =====
//
// CORE-TS-007 (no `any`, no non-null `!`, no `no-unsafe-*`) is only a GATE
// because the rules that implement it cannot be switched off by a one-line
// comment. This JS plugin provides that guarantee under Oxlint (`.oxlintrc.json`).
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
//
// ── What can still get past this ────────────────────────────────────────────
// One shape, and it is the same one authoritative ESLint has: a FILE-WIDE
// `/* oxlint-disable pinpoint/no-restricted-disable-directives */`, which
// suppresses this rule on the very line it sits on and everywhere below. Every
// `-next-line` variant is closed (see GOVERNANCE_DISABLE_PATTERNS), and a
// file-wide disable of only the unicorn rule is still caught, because this rule
// survives to report it. Closing the last one needs an engine feature — a rule
// that cannot be suppressed — which oxlint reserves for its own natives.

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
 * The three CORE-TS-007 rule families, matched engine-prefix-agnostically.
 * Exported so the fixture test can assert on the same list the rule enforces
 * rather than a copy of it.
 *
 * ── Why bare names are matched, not just namespaced ones ────────────────────
 * A bare name is a WORKING suppression in oxlint, not a typo: verified against
 * 1.79 that `// oxlint-disable-next-line no-explicit-any` silences
 * `typescript/no-explicit-any` just as the namespaced form does. So dropping
 * bare coverage would leave a real escape hatch open, which is why these anchor
 * on `(?:^|\/)` rather than requiring a namespace.
 */
export const RESTRICTED_DISABLE_PATTERNS = [
  /(?:^|\/)no-explicit-any$/,
  /(?:^|\/)no-non-null-assertion$/,
  // The typescript-eslint `no-unsafe-*` family, MINUS the three ESLint core
  // rules that share the prefix and have nothing to do with CORE-TS-007:
  // `no-unsafe-finally`, `no-unsafe-negation`, `no-unsafe-optional-chaining`
  // (all enabled in `.oxlintrc.json`). Without the exclusion a legitimate
  // `// eslint-disable-next-line no-unsafe-optional-chaining -- reason` passes
  // authoritative ESLint — whose original restricted only the namespaced
  // `@typescript-eslint/no-unsafe-*` glob — and fails the local mirror with a
  // misleading CORE-TS-007 message. That is mirror drift in the worst
  // direction: blocking a developer locally while CI stays green.
  //
  // Excluding by name rather than requiring a `typescript/` namespace keeps the
  // rule fail-closed: a future typescript-eslint `no-unsafe-<something>` is
  // covered the day it ships, and only this explicit, verified list of three
  // escapes. A new ESLint CORE `no-unsafe-*` rule would over-catch, which is
  // both far less likely and far more visible than under-catching a TS rule.
  /(?:^|\/)no-unsafe-(?!finally$|negation$|optional-chaining$)[a-z-]+$/,
];

/**
 * Rule names that are not themselves CORE-TS-007, but whose suppression turns
 * the gate off — so they are restricted for the same reason, with a message
 * that says the actual reason.
 *
 * Each one was verified to be an exploitable bypass against oxlint 1.79 before
 * being listed. The pattern is always the same: a `-next-line` directive
 * naming a governance rule silences that rule on the line below, and the thing
 * being silenced is what would have caught the directive below it. The report
 * for a directive lands on the directive's OWN line, which `-next-line` does
 * not cover, so restricting the name here is what closes each hole.
 */
export const GOVERNANCE_DISABLE_PATTERNS = [
  // This rule. `// oxlint-disable-next-line pinpoint/no-restricted-disable-directives`
  // above a restricted directive otherwise silences the whole gate for a line.
  /(?:^|\/)no-restricted-disable-directives$/,
  // Its sibling. Same shape: disable it on one line and the undescribed
  // directive below it goes unreported.
  /(?:^|\/)require-directive-description$/,
  // The blanket-disable ban. This is the sharpest of the three, because the
  // native `unicorn/no-abusive-eslint-disable` is the ONLY rule that can see a
  // blanket disable (a jsPlugin's own report is suppressed by it). So this pair
  //
  //     // oxlint-disable-next-line unicorn/no-abusive-eslint-disable -- any reason
  //     /* oxlint-disable */
  //
  // turned off every rule in the file, all three CORE-TS-007 rules included,
  // and produced zero diagnostics.
  /(?:^|\/)no-abusive-eslint-disable$/,
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
      governance:
        "'{{rule}}' must not be disabled by comment — it is what enforces CORE-TS-007, so silencing it silences the gate (PP-8k07).",
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
            } else if (
              GOVERNANCE_DISABLE_PATTERNS.some((re) => re.test(rule))
            ) {
              context.report({
                loc: comment.loc,
                messageId: "governance",
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
