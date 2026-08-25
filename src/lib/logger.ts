import pino from "pino";
import { mkdirSync } from "fs";
import { join } from "path";

import { maskEmail } from "~/lib/logging/mask";

const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";
const DEFAULT_LOG_ROOT = join(process.cwd(), "logs");

/**
 * Log-payload keys that may carry a raw email address.
 *
 * CORE-SEC-007 is scoped to display surfaces, so this list — not that rule —
 * is what keeps user emails out of `logs/<session>/app.log` and, on Vercel,
 * production stdout. The house precedent is still call-site masking with
 * `maskEmail` (`~/lib/logging/mask`); this list is the backstop for the call
 * sites that forget.
 *
 * `email` and `reporterEmail` are the only two that reach `log.*` today. The
 * other three are defensive: `submittedEmail` is the login-form value in
 * `src/app/(auth)/actions.ts`, which is returned to the client in a `Result`
 * error payload and never logged, and `userEmail` / `contactEmail` do not
 * exist at all. A backstop that only covers names already in use is one commit
 * away from being wrong.
 *
 * `to` is deliberately absent even though `src/lib/email/client.ts` logs it.
 * The name is too generic — timeline events log `{ from, to }` for status,
 * title and presence changes, and redacting those would cost real debugging
 * signal to cover a call site that already masks with `maskEmail`. This list
 * takes only names that can mean nothing but an email address.
 *
 * **What a key list cannot catch**: an address embedded in a *value*. A mail
 * provider send failure carries the recipient in its `message`, `stack`,
 * `rejected`, `envelope.to` and `response`, none under an email-named key. Those are masked
 * by the `err` serializer below ({@link maskingErrSerializer}) — a serializer,
 * not more key names, because the address is a value (PP-45qx).
 */
const EMAIL_LOG_KEYS = [
  "email",
  "reporterEmail",
  "userEmail",
  "contactEmail",
  "submittedEmail",
] as const;

/**
 * How many `*.` wildcard levels each key in {@link EMAIL_LOG_KEYS} gets.
 *
 * Pino's `*` matches exactly one level, so the previous `["email", "*.email"]`
 * form wrote `{ ctx: { user: { email } } }` out raw (PP-tg9y). Depth 3 means a
 * key is caught anywhere from the top level of the payload down to four levels
 * in — `{ a: { b: { c: { email } } } }`.
 *
 * Three, and not "as deep as possible", for two reasons. Pino has no recursive
 * wildcard, so unbounded is not on the menu — only more paths. And wildcard
 * paths are the expensive part of redaction, at roughly linear cost in
 * keys × levels: benchmarked on pino 10.3.1 / node 24 with a representative
 * payload, no redaction was ~0.8µs per `log.info`, the old four-path list
 * ~2.4µs, and these 20 paths ~17.9µs. That is noise against a serverless
 * invocation measured in tens of milliseconds, but it is why the list is an
 * explicit set rather than an open-ended one.
 *
 * Three is also two levels of headroom over the deepest shape any current call
 * site produces — `reportError` spreads a context object into the payload, so
 * a domain object passed as context puts its keys one level down.
 */
const EMAIL_REDACT_WILDCARD_DEPTH = 3;

/**
 * `["email", …, "*.email", …, "*.*.*.submittedEmail"]` — every key in
 * {@link EMAIL_LOG_KEYS} at every depth up to
 * {@link EMAIL_REDACT_WILDCARD_DEPTH}.
 */
const EMAIL_REDACT_PATHS: string[] = Array.from(
  { length: EMAIL_REDACT_WILDCARD_DEPTH + 1 },
  (_unused, depth) => "*.".repeat(depth)
).flatMap((prefix) => EMAIL_LOG_KEYS.map((key) => `${prefix}${key}`));

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
 *   frames (every `node_modules` frame in this repo) and version strings like
 *   `runner@4.1.10` (numeric last segment) — so it does not shred the stack
 *   traces it is meant to preserve.
 * - The leading negative lookbehind anchors each match at a token boundary (the
 *   preceding character is a delimiter, or it is the start of the string). This
 *   does two jobs at once. It keeps the scan *linear*: after the match at a
 *   token start fails, every interior character is rejected in O(1) by the
 *   lookbehind, so a long malformed `aaaa…@bbbb…` token with no TLD cannot drive
 *   the quadratic per-start re-scan that unbounded runs otherwise cause (an
 *   80 KB such token in a provider response took ~6.6 s and blocked the event
 *   loop; anchored, it is under a millisecond). And because the runs stay
 *   unbounded, an overlong or unusual local part is masked in *full* rather than
 *   suffix-matched from the middle — a 77-character local part becomes `abc***`,
 *   not thirteen raw characters plus `abc***`.
 *
 * An apostrophe is a valid unquoted-local-part character (`o'hara@example.com`),
 * so it is *not* a delimiter — excluding it would match only `hara@…` and leave
 * `o'har***` in the log, five of six local-part characters instead of three. A
 * double quote still is a delimiter (it frames a quoted local part).
 *
 * Both a bare `a@b.com` and one wrapped in SMTP punctuation (`550 <a@b.com>`)
 * yield exactly the address. Two known, accepted gaps — neither a realistic
 * recipient address, and closing either would over-mask ordinary log text:
 * a quoted local part with whitespace (`"john doe"@x.com`), and an address
 * literal domain (`user@[192.168.1.1]`, bracket-delimited on both sides).
 */
const EMBEDDED_EMAIL_RE =
  /(?<![^\s"<>()[\]{},;:@/\\])[^\s"<>()[\]{},;:@/\\]+@[^\s"<>()[\]{},;:@/\\]+\.\p{L}{2,63}/gu;

/** Replace every email-like substring of `value` with its {@link maskEmail} form. */
function maskEmailsInText(value: string): string {
  return value.replace(EMBEDDED_EMAIL_RE, (match) => maskEmail(match));
}

/** Recursion cap for {@link maskEmailsDeep} — a stack-overflow guard for a deep, non-cyclic chain. */
const MAX_MASK_DEPTH = 64;
/** Placeholder for a value that is too deep, or that threw while being read. */
const UNMASKABLE_PLACEHOLDER = "[unserializable]";
/** Placeholder for an object already visited on this pass (cycle or shared reference). */
const CIRCULAR_PLACEHOLDER = "[circular]";

/**
 * Return a copy of an already-serialized error with the email addresses in its
 * string values masked.
 *
 * The key-based {@link EMAIL_REDACT_PATHS} redaction cannot reach an address
 * that lives in a *value* rather than under an email-named key. A mail-provider
 * send failure carries the recipient exactly there — in `message`, `stack`,
 * `rejected`, `envelope.to` and `response` — so without this the raw address
 * reaches the log through `reportError`'s `err` serializer (PP-45qx). Masking
 * the substrings keeps the diagnostic (`550 <vic***> unknown`) while dropping
 * the address; it does not blank the error.
 *
 * Rebuilds rather than mutating in place, and this matters for safety: a
 * provider error can carry a frozen or getter-only nested value (an idiomatic
 * `Object.freeze`d context, a class instance from an SDK), and assigning into
 * one throws — pino does not catch serializer errors, so an in-place approach
 * turns "an address leaked" into "the log call itself throws", inside the very
 * catch block reporting the original failure. Reading a source value never
 * throws for those shapes; a read that *does* throw (a throwing getter) is
 * caught per-key.
 *
 * Two termination guards, because the depth cap alone is not enough. `seen`
 * tracks every object visited on the pass and short-circuits a repeat: a
 * branching self-cycle (`n.a = n; n.b = n`) or a diamond DAG would otherwise
 * fan out to ~2^depth visits before the cap stopped it, hanging the event loop
 * while an error is being reported. The depth cap then bounds a deep, non-cyclic
 * chain that no repeat catches. Both replace the offending subtree with a
 * placeholder, which fails safe (no raw remainder).
 *
 * A value carrying its own `toJSON` (a `Date`, a `URL`, or an SDK class that
 * exposes only a redacted summary) is serialized *through* it and the result
 * masked — not flattened field-by-field, which would strip the prototype,
 * bypass the class's own redaction (potentially logging a token it hides), and
 * collapse a slot-backed object like `URL` to `{}`. Typed arrays hold bytes,
 * never a maskable address, and are large, so they pass through untouched.
 */
function maskEmailsDeep(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") return maskEmailsInText(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
  if (ArrayBuffer.isView(value)) return value;
  if (depth >= MAX_MASK_DEPTH) return UNMASKABLE_PLACEHOLDER;
  seen.add(value);

  let toJSON: (() => unknown) | undefined;
  try {
    const candidate = (value as { toJSON?: unknown }).toJSON;
    if (typeof candidate === "function") toJSON = candidate as () => unknown;
  } catch {
    // A throwing `toJSON` accessor — treat the value as having none.
  }
  if (toJSON) {
    try {
      return maskEmailsDeep(toJSON.call(value), depth + 1, seen);
    } catch {
      return UNMASKABLE_PLACEHOLDER;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskEmailsDeep(item, depth + 1, seen));
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    try {
      result[key] = maskEmailsDeep(source[key], depth + 1, seen);
    } catch {
      // A throwing getter (or any read failure) must not crash the log call.
      result[key] = UNMASKABLE_PLACEHOLDER;
    }
  }
  return result;
}

/**
 * Pino's `err` serializer, wrapped to also mask email addresses embedded in the
 * serialized error's string values (see {@link maskEmailsDeep}). `stdSerializers.err`
 * copies every own enumerable error property, so a provider send failure would
 * otherwise carry the raw recipient into the log.
 */
function maskingErrSerializer(error: Error): unknown {
  try {
    return maskEmailsDeep(pino.stdSerializers.err(error), 0, new WeakSet());
  } catch {
    // `stdSerializers.err` reads every own enumerable error property, so a
    // throwing getter on the error can fail here, before maskEmailsDeep runs.
    // pino does not catch serializer errors, so fall back to a minimal masked
    // shape rather than throwing out of the log call.
    let message = UNMASKABLE_PLACEHOLDER;
    try {
      message = maskEmailsInText(String(error.message));
    } catch {
      // Keep the placeholder if even the message cannot be read.
    }
    return { type: "Error", message };
  }
}

/**
 * Options shared by every logger instance. Exported so tests can exercise the
 * real redaction config against an in-memory stream rather than a copy of it.
 */
export const baseLoggerOptions: pino.LoggerOptions = {
  level: LOG_LEVEL,
  // Redact PII (email) from log output at any realistic nesting depth; uses
  // Pino's default "[Redacted]" censor.
  redact: EMAIL_REDACT_PATHS,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  // Pino's stdSerializers.err only fires for the `err` key. All call sites have
  // been standardised to use `err`, so wrapping it here also catches addresses
  // embedded in error values (message/stack/rejected/envelope.to/response) that
  // the key-based redact list cannot reach (PP-45qx).
  serializers: {
    err: maskingErrSerializer,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

/**
 * Creates a timestamped directory name in format: YYYY-MM-DD_HH-mm-ss
 * This ensures each server restart gets its own log directory
 */
function getTimestampedDir(): string {
  const now = new Date();
  const isoString = now.toISOString();
  const date = isoString.split("T")[0] ?? "unknown-date"; // YYYY-MM-DD
  const time =
    now.toTimeString().split(" ")[0]?.replace(/:/g, "-") ?? "unknown-time"; // HH-mm-ss
  return `${date}_${time}`;
}

/**
 * Attempt to create a session-specific log directory.
 * Falls back to undefined when the filesystem is read-only (e.g., Vercel serverless).
 */
function tryCreateSessionDirectory(): string | undefined {
  const baseDir = process.env["PINPOINT_LOG_DIR"] ?? DEFAULT_LOG_ROOT;
  try {
    mkdirSync(baseDir, { recursive: true });
    const sessionDir = join(baseDir, getTimestampedDir());
    mkdirSync(sessionDir, { recursive: true });
    return sessionDir;
  } catch (error) {
    // Silently fall back to stdout in serverless/read-only environments
    // or if we lack permissions. This is expected behavior in Vercel.
    const hasErrorCode = (err: unknown): err is Error & { code: string } =>
      err instanceof Error && "code" in err && typeof err.code === "string";

    const isReadOnly =
      error instanceof Error &&
      ((hasErrorCode(error) &&
        ["EROFS", "EACCES", "EPERM"].includes(error.code)) ||
        error.message.includes("EROFS") ||
        error.message.includes("EACCES") ||
        error.message.includes("EPERM"));

    if (!isReadOnly) {
      console.warn(
        "[logger] Falling back to stdout-only logging (could not create log directory).",
        error instanceof Error ? error.message : error
      );
    }
    return undefined;
  }
}

/**
 * Create pino logger instance with:
 * - Timestamped directory per server restart (when filesystem is writable)
 * - Structured JSON logs
 * - Console output in development or when file logging is unavailable
 */
function createLogger(): pino.Logger {
  const sessionDir = tryCreateSessionDirectory();
  const logFile = sessionDir ? join(sessionDir, "app.log") : undefined;
  const isDevelopment = process.env.NODE_ENV === "development";

  const streams: pino.StreamEntry[] = [];

  if (logFile) {
    streams.push({
      stream: pino.destination({
        dest: logFile,
        sync: false,
        mkdir: true,
      }),
    });
  }

  if (!logFile || isDevelopment) {
    streams.push({ stream: process.stdout });
  }

  const [firstStream] = streams;

  if (!firstStream) {
    return pino(baseLoggerOptions);
  }

  if (streams.length === 1) {
    return pino(baseLoggerOptions, firstStream.stream);
  }

  return pino(baseLoggerOptions, pino.multistream(streams));
}

let loggerInstance: pino.Logger | null = null;

function getOrCreateLogger(): pino.Logger {
  loggerInstance ??= createLogger();
  return loggerInstance;
}

export function getLogger(): pino.Logger {
  return getOrCreateLogger();
}

export const log = {
  info: (obj: object | string, msg?: string): void => {
    getOrCreateLogger().info(obj, msg);
  },
  error: (obj: object | string, msg?: string): void => {
    getOrCreateLogger().error(obj, msg);
  },
  warn: (obj: object | string, msg?: string): void => {
    getOrCreateLogger().warn(obj, msg);
  },
  debug: (obj: object | string, msg?: string): void => {
    getOrCreateLogger().debug(obj, msg);
  },
};
