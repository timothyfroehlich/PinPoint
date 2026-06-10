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
// ── Why a custom rule instead of plain `no-restricted-syntax` ────────────────
// This is implemented as a local ESLint plugin rule (`pinpoint/...`) rather than
// a bare `no-restricted-syntax` entry for ONE concrete reason: flat config
// REPLACES (does not merge) a rule's options when a later block redefines it,
// and the `e2e/**` block already owns `no-restricted-syntax` (at "warn", for its
// @test.com-email nudge, which includes a documented known false positive — so
// it must stay "warn"). A second `no-restricted-syntax` entry for these
// selectors at "error" would either be silently dropped for e2e files (the hole)
// or, if merged in, drag the @test.com selectors up to "error" and break
// legitimate `getTestEmail("…@test.com")` calls. A distinct custom rule has its
// own severity slot, so it applies at "error" to every `**/*.ts(x)` file —
// including `e2e/**` — and coexists with the e2e `no-restricted-syntax` warn.
// It is wired in `eslint.config.mjs` and exercised by
// `src/test/eslint/no-side-effects-in-transaction.test.ts`.
//
// ── Selector strategy (zero-false-positive priority) ─────────────────────────
//   1. Anchor on the function argument of a `db.transaction(...)` /
//      `tx.transaction(...)` call. The receiver is constrained to an identifier
//      named `db` or `tx` (note: not just any `.transaction(` method) so a
//      hypothetical unrelated `stripe.transaction(...)` / IndexedDB
//      `store.transaction(...)` containing a banned call (e.g. `fetch`) cannot
//      false-positive. Every real Drizzle call site in the repo uses `db`;
//      matching `tx` additionally covers nested savepoints (`tx.transaction`),
//      which are still inside a transaction.
//   2. From that callback, match descendant calls to the banned side-effect
//      helpers by identifier name, plus direct Resend usage (`*.emails.send`).
// Calls to these helpers OUTSIDE a transaction (the correct post-commit /
// pre-transaction pattern) are descendants of no transaction callback and never
// match.
//
// ── Known limitation (intentional; backstopped at runtime) ───────────────────
// This is bare-identifier / direct-member matching. A side effect routed through
// an extracted helper, an aliased import, or an indirect callback (e.g.
// `withUserContext(db, …, fn)` where `fn` is defined elsewhere and receives
// `tx`) will NOT be flagged statically — that is an inherent limit of syntactic
// analysis. We do NOT chase it here: widening the net to catch indirection would
// reintroduce exactly the false positives the bead prioritizes avoiding. The
// AsyncLocalStorage runtime tripwire (`assertNotInTransaction`, fired from the
// real client wrappers) backstops every such indirect path at dev/test/CI
// runtime. This rule's job is to catch the common, direct, in-line case early.

// Function argument of a `db.transaction(...)` / `tx.transaction(...)` call.
const TX_CALLBACK_PREFIX =
  'CallExpression[callee.type="MemberExpression"][callee.property.name="transaction"][callee.object.name=/^(db|tx)$/] > :matches(ArrowFunctionExpression, FunctionExpression)';

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
 * esquery selectors (relative to a transaction callback) that flag a banned
 * side effect. Each is registered as a visitor key in the rule below; the same
 * list is reused by the test so fixtures exercise the production selectors.
 */
export const SIDE_EFFECT_SELECTORS = [
  ...SIDE_EFFECT_CALLEES.map(
    (name) => `${TX_CALLBACK_PREFIX} CallExpression[callee.name="${name}"]`
  ),
  // Direct Resend client usage (resend.emails.send / client.emails.send).
  `${TX_CALLBACK_PREFIX} CallExpression[callee.type="MemberExpression"][callee.property.name="send"][callee.object.property.name="emails"]`,
];

/**
 * Custom ESLint rule: report any banned side-effect call inside a db/tx
 * transaction callback. Registers each selector as a visitor key (ESLint runs
 * esquery for selector-keyed listeners), so the matched node is reported
 * directly.
 *
 * @type {import("eslint").Rule.RuleModule}
 */
export const noSideEffectsInTransactionRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow external side effects (HTTP, email, Discord, blob, Vault RPC) inside a db.transaction callback (CORE-ARCH-011).",
    },
    schema: [],
    messages: { sideEffectInTransaction: SIDE_EFFECT_IN_TRANSACTION_MESSAGE },
  },
  create(context) {
    /** @param {import("estree").Node} node */
    const report = (node) =>
      context.report({ node, messageId: "sideEffectInTransaction" });
    return Object.fromEntries(
      SIDE_EFFECT_SELECTORS.map((selector) => [selector, report])
    );
  },
};

/**
 * Flat-config plugin object. Spread its `rules` into a `plugins` entry, then
 * enable `"<prefix>/no-side-effects-in-transaction": "error"`.
 */
export const pinpointTransactionPlugin = {
  rules: { "no-side-effects-in-transaction": noSideEffectsInTransactionRule },
};
