// Fixture: pinpoint/no-restricted-disable-directives — the governance rules.
//
// These three are not CORE-TS-007 rules; they are what ENFORCES CORE-TS-007.
// Each case below was an exploitable bypass before it was restricted, and each
// works the same way: a `-next-line` directive naming a governance rule
// silences it on the line below, where the thing it would have caught sits.
// The report lands on the directive's own line, which `-next-line` does not
// cover — that is what closes each one.

// Smuggling a restricted directive past this rule by disabling it one line up.
// oxlint-disable-next-line pinpoint/no-restricted-disable-directives -- fixture: the self-disable bypass
// oxlint-disable-next-line typescript/no-explicit-any -- fixture: what the line above tries to hide
export const selfDisableBypass = 1;

// Same shape against the sibling rule: the undescribed directive below would
// otherwise go unreported.
// oxlint-disable-next-line pinpoint/require-directive-description -- fixture: sibling self-disable bypass
// oxlint-disable-next-line no-console
export const siblingDisableBypass = 2;

// The sharpest one. `unicorn/no-abusive-eslint-disable` is the ONLY rule that
// can see a blanket disable — a jsPlugin's own report is suppressed by it — so
// disabling the unicorn rule on the line above a blanket disable used to turn
// off every rule in the file, all three CORE-TS-007 rules included, for zero
// diagnostics. Kept last: the blanket directive suppresses whatever follows.
// oxlint-disable-next-line unicorn/no-abusive-eslint-disable -- fixture: the blanket-ban bypass
/* oxlint-disable -- fixture: the blanket disable the line above tries to license */
export const blanketBanBypass = 3;
