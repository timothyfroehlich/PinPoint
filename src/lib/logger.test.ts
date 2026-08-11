// @vitest-environment node
/**
 * The redact list in `~/lib/logger` is the backstop that keeps user emails out
 * of `logs/<session>/app.log` and, on Vercel, production stdout —
 * `.claude/rules/always.md` scopes CORE-SEC-007 to display surfaces and points
 * here for logs. Pino's `*` matches exactly one level, so the list is easy to
 * silently under-reach (PP-tg9y: `{ ctx: { user: { email } } }` was written
 * raw). These tests pin the depth it actually reaches.
 *
 * They drive the real exported `baseLoggerOptions` — not a copy of the path
 * list — through pino into an in-memory stream, so a change to the options
 * that breaks redaction fails here.
 */
import pino from "pino";
import { describe, expect, it } from "vitest";

import { baseLoggerOptions } from "~/lib/logger";

const EMAIL = "someone@example.com";

/** Log `payload` through the app's real logger options; return the JSON line. */
function logLine(payload: object): string {
  const lines: string[] = [];
  const logger = pino(
    // `level` is the one option overridden: LOG_LEVEL from a local `.env` must
    // not be able to silence the logger and turn these assertions vacuous.
    { ...baseLoggerOptions, level: "trace" },
    { write: (chunk: string) => lines.push(chunk) }
  );
  logger.info(payload, "test");
  const line = lines.join("");
  // Same reason: an empty line "does not contain" the email either.
  expect(line).toContain('"msg":"test"');
  return line;
}

describe("logger redaction", () => {
  it("redacts an email nested two levels deep", () => {
    // The PP-tg9y regression case: `*.email` alone leaves this raw.
    const line = logLine({ ctx: { user: { email: EMAIL } } });

    expect(line).not.toContain(EMAIL);
    expect(line).toContain("[Redacted]");
  });

  it.each([
    ["at the top level", { email: EMAIL }],
    ["one level down", { ctx: { email: EMAIL } }],
    ["two levels down", { ctx: { user: { email: EMAIL } } }],
    ["three levels down", { ctx: { user: { profile: { email: EMAIL } } } }],
    // An array index consumes a wildcard level, same as an object key.
    ["under an array index", { members: [{ email: EMAIL }] }],
  ])("redacts an email %s", (_label, payload) => {
    expect(logLine(payload)).not.toContain(EMAIL);
  });

  it.each(["reporterEmail", "userEmail", "contactEmail", "submittedEmail"])(
    "redacts a nested %s",
    (key) => {
      const line = logLine({ ctx: { issue: { [key]: EMAIL } } });

      expect(line).not.toContain(EMAIL);
    }
  );

  it("redacts an email hanging off a serialized error", () => {
    // `reportError` logs `{ ...context, err: error }`, so error properties land
    // one level down under `err`.
    const error = Object.assign(new Error("boom"), { email: EMAIL });

    expect(logLine({ err: error })).not.toContain(EMAIL);
  });

  it("leaves non-email fields alone", () => {
    const line = logLine({ ctx: { user: { name: "Ada", email: EMAIL } } });

    expect(line).toContain("Ada");
    expect(line).not.toContain(EMAIL);
  });
});
