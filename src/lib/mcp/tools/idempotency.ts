import "server-only";

import { createHash } from "node:crypto";

/**
 * How long an identical mutating call is treated as a retry of the same request
 * rather than a second, deliberate one.
 *
 * MCP has no client-supplied idempotency token, so the key is derived from the
 * call itself: same admin, same target, same field-for-field content, same
 * window. A transport-level retry resends byte-identical arguments and lands on
 * the same key, so the service returns the original row instead of writing a
 * duplicate.
 *
 * The window is what keeps this from being wrong in the other direction — a
 * genuine re-report of the same fault weeks later ("left flipper weak" after a
 * repair regressed) must file a NEW row, not silently resolve to the old one. A
 * retry that straddles a window boundary degrades to the previous behaviour (a
 * duplicate), which is the safe direction to fail.
 */
const RETRY_WINDOW_MS = 10 * 60 * 1000;

/**
 * The joiner for an idempotency key's field parts: a NUL, written as the
 * `\u0000` ESCAPE and never as a literal byte. A literal NUL in the source makes
 * the whole file binary to the toolchain — `git diff` reports "Binary files
 * differ" so the file is unreviewable, and `rg` skips it in directory searches,
 * which silently drops it out of every future codebase sweep.
 */
const KEY_SEPARATOR = "\u0000";

/**
 * Render `parts` as a content-addressed **UUIDv8**, the shared derivation behind
 * every MCP tool's idempotency key.
 *
 * The `idempotency_key` columns are Postgres `uuid`, so the SHA-256 digest is
 * rendered as v8 — the RFC 9562 version reserved for custom,
 * implementation-defined layouts, which is what a hash-derived identifier is.
 * (v4 would misrepresent these bits as random; v5 specifically means SHA-1 over
 * a namespace.)
 *
 * Parts are NUL-joined so no field's content can impersonate a boundary between
 * two others ("ab" + "c" must not hash the same as "a" + "bc"). Callers append
 * `String(Math.floor(now / RETRY_WINDOW_MS))` as the window part.
 *
 * One implementation rather than one per tool: the bit-stamping is the part that
 * has to be identical everywhere, and a second copy is a second chance to get
 * the version or variant nibble wrong in a way no caller would notice.
 */
export function contentAddressedUuid(parts: readonly string[]): string {
  const digest = createHash("sha256")
    .update(parts.join(KEY_SEPARATOR))
    .digest();

  // Take the leading 16 bytes and stamp the version (8) and RFC 4122 variant
  // bits in place, then render the canonical 8-4-4-4-12 form.
  const bytes = digest.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** The current retry window, as the trailing part of an idempotency key. */
export function retryWindowPart(now: number): string {
  return String(Math.floor(now / RETRY_WINDOW_MS));
}
