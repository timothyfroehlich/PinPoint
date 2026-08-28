// Fixture: pinpoint/no-restricted-disable-directives — the CORE-TS-007 rules.
//
// Every directive here carries a `-- description`, so
// pinpoint/require-directive-description must stay silent on this file: the two
// rules are independent and a fixture that violated both would not prove it.
//
// The rules that ENFORCE the gate rather than being part of it live in
// `governance-disable.ts`; the core `no-unsafe-*` rules that must stay
// disable-able live in `allowed-core-unsafe.ts`.

// oxlint-disable-next-line typescript/no-explicit-any -- fixture: oxlint prefix, oxlint namespace
export const fromOxlintNamespace = 1;

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- fixture: eslint prefix, typescript-eslint namespace
export const fromTypescriptEslintNamespace = 2;

// A bare name is a WORKING suppression in oxlint, not a typo, so it must be
// caught: `// oxlint-disable-next-line no-explicit-any` really does silence
// `typescript/no-explicit-any` (verified against 1.79).
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
