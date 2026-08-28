// Fixture: the three ESLint CORE `no-unsafe-*` rules must stay disable-able.
//
// They share a prefix with the typescript-eslint `no-unsafe-*` family but have
// nothing to do with CORE-TS-007, and all three are enabled in
// `.oxlintrc.json`. Authoritative ESLint restricts only the namespaced
// `@typescript-eslint/no-unsafe-*` glob, so catching these would block a
// developer locally while CI stayed green — mirror drift in the worst
// direction.
//
// This file must produce ZERO diagnostics.

// eslint-disable-next-line no-unsafe-optional-chaining -- fixture: ESLint core, not CORE-TS-007
export const a = 1;

// oxlint-disable-next-line no-unsafe-finally -- fixture: ESLint core, not CORE-TS-007
export const b = 2;

// eslint-disable-next-line no-unsafe-negation -- fixture: ESLint core, not CORE-TS-007
export const c = 3;
