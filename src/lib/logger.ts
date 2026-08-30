import pino from "pino";
import { mkdirSync } from "fs";
import { join } from "path";

import { maskEmailsDeep, maskEmailsInText } from "~/lib/logging/mask";

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

/** Placeholder for a value that is too deep, or that threw while being read. */
const UNMASKABLE_PLACEHOLDER = "[unserializable]";

/**
 * Pino's `err` serializer, wrapped to also mask email addresses embedded in the
 * serialized error's string values (see {@link maskEmailsDeep}). `stdSerializers.err`
 * copies every own enumerable error property, so a provider send failure would
 * otherwise carry the raw recipient into the log.
 */
function maskingErrSerializer(error: Error): unknown {
  try {
    return maskEmailsDeep(pino.stdSerializers.err(error));
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
