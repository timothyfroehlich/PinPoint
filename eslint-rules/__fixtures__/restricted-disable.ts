// Fixture: pinpoint/no-restricted-disable-directives — named CORE-TS-007 rules.
//
// Every directive here carries a `-- description`, so
// pinpoint/require-directive-description must stay silent on this file: the two
// rules are independent and a fixture that violated both would not prove it.

// oxlint-disable-next-line typescript/no-explicit-any -- fixture: oxlint prefix, oxlint namespace
export const fromOxlintNamespace = 1;

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- fixture: eslint prefix, typescript-eslint namespace
export const fromTypescriptEslintNamespace = 2;

// oxlint-disable-next-line no-unsafe-assignment -- fixture: bare name, the no-unsafe-* family
export const bareUnsafeName = 3;

// eslint-disable-next-line no-console, typescript/no-explicit-any -- fixture: restricted rule hiding in a list
export const inAList = 4;

// A rule nobody restricted, named and explained: the rule must not fire here.
// oxlint-disable-next-line no-console -- fixture: legitimate, unrestricted suppression
export const legitimate = 5;

// The restricted names appearing only in the DESCRIPTION half must not fire —
// prose after `--` is documentation, not a rule list.
// oxlint-disable-next-line no-console -- fixture: mentions no-explicit-any in prose only
export const proseMention = 6;

// Disabling THIS rule one line above a restricted directive is the obvious
// bypass, so the rule restricts its own name: the report lands on this line,
// which the `-next-line` form below does not reach.
// oxlint-disable-next-line pinpoint/no-restricted-disable-directives -- fixture: the self-disable bypass
// oxlint-disable-next-line typescript/no-explicit-any -- fixture: what the line above tries to hide
export const selfDisableBypass = 7;
