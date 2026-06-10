// ===== CORE-ARCH-011: no external side effects inside db.transaction =====
//
// Static backstop to the runtime tripwire in
// src/server/db/transaction-context.ts (the Doodle Bug, PP-2053). External /
// non-transactional side effects — email, Discord DMs, blob storage, the
// Discord-config Vault RPC, notification dispatch, and raw HTTP — must run
// AFTER commit, never inside a `db.transaction(...)` callback. A pre-commit
// external call that "succeeds" before a rolled-back transaction ships a side
// effect for data that was never persisted (silent write-loss).
//
// This module is the single source of truth for the rule's `no-restricted-syntax`
// options. `eslint.config.mjs` spreads it into the live config;
// `src/test/eslint/no-side-effects-in-transaction.test.ts` lints fixtures against
// it directly (syntax-only, no type-aware project) to prove fire / no-fire.
//
// Selector strategy (zero-false-positive priority):
//   1. Anchor on the function argument of a `*.transaction(...)` call. Every
//      `.transaction(` receiver in this repo is the Drizzle `db`; matching the
//      method name also covers nested savepoints (`tx.transaction(...)`), which
//      are still inside a transaction. No unrelated `.transaction()` API exists.
//   2. From that callback, match descendant calls to the banned side-effect
//      helpers by identifier name, plus direct Resend usage (`*.emails.send`).
// Calls to these helpers OUTSIDE a transaction (the correct post-commit /
// pre-transaction pattern) are descendants of no transaction callback and never
// match.

const TX_CALLBACK_PREFIX =
  'CallExpression[callee.property.name="transaction"] > :matches(ArrowFunctionExpression, FunctionExpression)';

/** Side-effect helpers banned by bare identifier when called inside a transaction. */
export const SIDE_EFFECT_CALLEES = [
  "sendEmail",
  "sendDm",
  "dispatchNotification",
  "uploadToBlob",
  "deleteFromBlob",
  "getDiscordConfig",
  "fetch",
];

export const SIDE_EFFECT_IN_TRANSACTION_MESSAGE =
  "External side effect called inside a db.transaction callback. HTTP, email, " +
  "Discord, blob, and Vault-RPC calls must run AFTER commit, never inside " +
  "db.transaction — see CORE-ARCH-011 (the Doodle Bug, PP-2053). Fetch inputs " +
  "before the transaction; deliver effects after commit via after() + " +
  "planNotification/dispatchNotification.";

/**
 * `no-restricted-syntax` option objects (without the leading "error" level).
 * Spread into the rule config and into the test's inline flat config.
 */
export const noSideEffectsInTransactionOptions = [
  ...SIDE_EFFECT_CALLEES.map((name) => ({
    selector: `${TX_CALLBACK_PREFIX} CallExpression[callee.name="${name}"]`,
    message: SIDE_EFFECT_IN_TRANSACTION_MESSAGE,
  })),
  {
    // Direct Resend client usage (resend.emails.send / client.emails.send).
    selector: `${TX_CALLBACK_PREFIX} CallExpression[callee.type="MemberExpression"][callee.property.name="send"][callee.object.property.name="emails"]`,
    message: SIDE_EFFECT_IN_TRANSACTION_MESSAGE,
  },
];
