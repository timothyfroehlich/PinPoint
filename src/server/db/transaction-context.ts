import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Runtime tripwire enforcing CORE-ARCH-011: external/non-transactional side
 * effects (HTTP, email, Discord, blob, Vault RPC) must never run inside a DB
 * transaction — they belong after commit.
 *
 * Incident — the "Doodle Bug" (PP-2053): an issue-confirmation email was sent
 * from a Resend HTTP call executed INSIDE the issue-creation transaction,
 * before COMMIT. When the request was killed mid-flight the transaction rolled
 * back, but the email had already gone out — the user got a working link to an
 * issue that was never persisted, and no alert fired. Silent write-loss.
 *
 * Mechanism: `db.transaction` (see ./index and the PGlite test setup) runs its
 * callback inside `runInTransactionContext`, which sets an AsyncLocalStorage
 * flag for the callback's duration. The side-effect client wrappers call
 * `assertNotInTransaction(...)` on entry; if the flag is set, they throw.
 * Any reintroduction of a pre-commit external call therefore fails loudly in
 * dev, test, and CI instead of silently shipping to production.
 *
 * Two-layer enforcement (PP-lbqh):
 *  1. Static  — ESLint rule `pinpoint/no-side-effects-in-transaction` in
 *               `eslint-rules/no-side-effects-in-transaction.mjs`. Catches
 *               direct, inline calls by identifier at lint/CI time.
 *               Limitation: cannot follow aliased imports or indirect callbacks.
 *  2. Runtime — `assertNotInTransaction()` called at the top of each
 *               side-effecting wrapper (sendEmail, sendDm, uploadToBlob,
 *               deleteFromBlob, getDiscordConfig, isDiscordIntegrationEnabled).
 *               Backstops every path the static rule can't see.
 * Keep both layers in sync when adding a new side-effect entry point: add the
 * function name to `SIDE_EFFECT_CALLEES` in the ESLint rule AND add an
 * `assertNotInTransaction(...)` call inside the new function.
 */
const transactionStorage = new AsyncLocalStorage<true>();

/**
 * Run `fn` with the in-transaction flag set for its (async) duration. Used by
 * the `db.transaction` wrappers; not intended for direct use elsewhere.
 */
export function runInTransactionContext<T>(fn: () => Promise<T>): Promise<T> {
  return transactionStorage.run(true, fn);
}

/** True when the current async execution is inside a DB transaction callback. */
export function isInTransaction(): boolean {
  return transactionStorage.getStore() === true;
}

/**
 * Thrown when an external side effect is attempted inside a DB transaction.
 * Names the offending call and points at the fix (run it post-commit).
 */
export class SideEffectInTransactionError extends Error {
  constructor(sideEffect: string) {
    super(
      `${sideEffect} was called inside a database transaction. External side ` +
        `effects (HTTP, email, Discord, blob, Vault RPC) must run AFTER commit, ` +
        `never inside db.transaction — see CORE-ARCH-011 (the Doodle Bug, ` +
        `PP-2053). Move the call to a post-commit step, e.g. after() or ` +
        `dispatchNotification().`
    );
    this.name = "SideEffectInTransactionError";
  }
}

/**
 * Guard for side-effect client wrappers. Throws `SideEffectInTransactionError`
 * when invoked inside a DB transaction callback; no-op otherwise.
 */
export function assertNotInTransaction(sideEffect: string): void {
  if (isInTransaction()) {
    throw new SideEffectInTransactionError(sideEffect);
  }
}
