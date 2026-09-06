/**
 * PII masking helpers for observability output.
 *
 * Established precedent is call-site masking: mask the value where it is
 * logged rather than relying on a global log redactor. Keeps recipient /
 * account PII out of logs while retaining just enough of a prefix to
 * correlate entries during debugging.
 */

/**
 * Mask an email address for logging: keep the first (up to) three characters
 * and replace the remainder with `***`.
 *
 * Handles short and empty strings gracefully — an empty string yields `"***"`.
 */
export function maskEmail(email: string): string {
  return email.slice(0, 3) + "***";
}

/**
 * Matches an email address embedded anywhere in a string.
 *
 * The runs either side of the `@` are "any run of characters that cannot
 * delimit or path-separate an address" — no whitespace, double quote, brackets,
 * braces, slashes, or the punctuation that frames one in error text — and the
 * domain must end in an alphabetic TLD (`\p{L}{2,63}`). Three forces shape this:
 *
 * - The `u` flag plus `\p{L}` match by code point, so an internationalised
 *   domain (`user@exämple.com`, or a `.рф`/`.中国` TLD) is caught; an ASCII-only
 *   class stops at the first non-ASCII byte and would leak the whole address.
 * - Excluding `/` `\` and requiring a *letter* TLD keeps the pattern off things
 *   that merely contain an `@` — pnpm's `.pnpm/@scope+pkg@1.2.3/…` stack-trace
 *   frames and version strings like `runner@4.1.10` — so it does not shred the
 *   diagnostics it is meant to preserve.
 * - The leading negative lookbehind anchors each match at a token boundary. It
 *   keeps the scan linear for a long malformed `aaaa…@bbbb…` token and ensures
 *   an overlong local part is masked in full rather than suffix-matched.
 *
 * An apostrophe is a valid unquoted-local-part character (`o'hara@example.com`),
 * so it is not a delimiter. Two known, accepted gaps are a quoted local part
 * containing whitespace and an address-literal domain; matching either would
 * over-mask ordinary diagnostic text.
 */
const EMBEDDED_EMAIL_RE =
  /(?<![^\s"<>()[\]{},;:@/\\])[^\s"<>()[\]{},;:@/\\]+@[^\s"<>()[\]{},;:@/\\]+\.\p{L}{2,63}/gu;

/**
 * Raw address reached by decoding a URL or query string. Running this before
 * the general matcher preserves the URL prefix instead of treating
 * `signup?email=victim` as the local part.
 */
const URI_DELIMITED_EMAIL_RE =
  /(?<=[=?&#])[^\s"<>()[\]{},;:@/\\=?&#]+@[^\s"<>()[\]{},;:@/\\=?&#]+\.\p{L}{2,63}/gu;

/** Candidate token containing an encoded `@`, including nested `%25` layers. */
const EMBEDDED_ENCODED_EMAIL_CANDIDATE_RE =
  /(?<![^\s"<>()[\]{},;:=?&#/\\])[^\s"<>()[\]{},;:=?&#/\\]*%(?:25)*40[^\s"<>()[\]{},;:=?&#/\\]*/giu;

const ENCODED_AT_RE = /%(?:25)*40/iu;
const MAX_PERCENT_DECODE_PASSES = 8;
const REDACTED_PLACEHOLDER = "[redacted]";

function maskRawEmails(value: string): string {
  return value
    .replace(URI_DELIMITED_EMAIL_RE, (email) => maskEmail(email))
    .replace(EMBEDDED_EMAIL_RE, (email) => maskEmail(email));
}

function maskEncodedEmailCandidate(match: string): string {
  let decoded = match;
  let maskedAnyEmail = false;

  for (let pass = 0; pass < MAX_PERCENT_DECODE_PASSES; pass += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return REDACTED_PLACEHOLDER;
    }

    const masked = maskRawEmails(decoded);
    maskedAnyEmail ||= masked !== decoded;
    decoded = masked;

    if (!ENCODED_AT_RE.test(decoded)) {
      return maskedAnyEmail ? decoded : match;
    }
  }

  return REDACTED_PLACEHOLDER;
}

/** Replace every email-like substring of `value` with its {@link maskEmail} form. */
export function maskEmailsInText(value: string): string {
  return maskRawEmails(value).replace(
    EMBEDDED_ENCODED_EMAIL_CANDIDATE_RE,
    maskEncodedEmailCandidate
  );
}

/** Stack-overflow guard for a deep, non-cyclic value. */
const MAX_MASK_DEPTH = 64;
/** Placeholder for a value that is too deep, or that threw while being read. */
const UNMASKABLE_PLACEHOLDER = "[unserializable]";
/** Placeholder for an object already visited on this pass (cycle or shared reference). */
const CIRCULAR_PLACEHOLDER = "[circular]";

/**
 * Return a copy of an observability value with email addresses masked in every
 * string it contains.
 *
 * Rebuilding keeps frozen and getter-only values safe. A visited-object guard
 * bounds cycles and diamond graphs; a depth cap bounds deep non-cyclic chains.
 * Values with `toJSON` are serialized through it so SDK classes keep their own
 * redaction behavior instead of exposing backing fields.
 */
export function maskEmailsDeep(value: unknown): unknown {
  return maskEmailsDeepValue(value, "", 0, new WeakSet());
}

function maskEmailsDeepValue(
  value: unknown,
  key: string,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") return maskEmailsInText(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
  if (ArrayBuffer.isView(value)) return value;
  if (depth >= MAX_MASK_DEPTH) return UNMASKABLE_PLACEHOLDER;
  seen.add(value);

  let toJSON: ((key: string) => unknown) | undefined;
  try {
    const candidate = (value as { toJSON?: unknown }).toJSON;
    if (typeof candidate === "function") {
      toJSON = candidate as (key: string) => unknown;
    }
  } catch {
    // A throwing `toJSON` accessor — treat the value as having none.
  }
  if (toJSON) {
    try {
      return maskEmailsDeepValue(toJSON.call(value, key), key, depth + 1, seen);
    } catch {
      return UNMASKABLE_PLACEHOLDER;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      maskEmailsDeepValue(item, String(index), depth + 1, seen)
    );
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const childKey of Object.keys(source)) {
    try {
      result[childKey] = maskEmailsDeepValue(
        source[childKey],
        childKey,
        depth + 1,
        seen
      );
    } catch {
      // A throwing getter (or any read failure) must not crash observability.
      result[childKey] = UNMASKABLE_PLACEHOLDER;
    }
  }
  return result;
}
