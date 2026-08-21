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

  it("redacts an email-named property on a serialized error", () => {
    // `reportError` logs `{ ...context, err: error }`, so error properties land
    // one level down under `err`. Pino's `err` serializer copies every own
    // enumerable property, so a key named like an email is caught here the same
    // as anywhere else.
    //
    // This is the key-name case. An address embedded in the error's `message`,
    // `stack` or a provider field is a separate mechanism, masked by the `err`
    // serializer and covered by the "value fields" test below (PP-45qx).
    const error = Object.assign(new Error("boom"), { email: EMAIL });

    expect(logLine({ err: error })).not.toContain(EMAIL);
  });

  it("leaves non-email fields alone", () => {
    const line = logLine({ ctx: { user: { name: "Ada", email: EMAIL } } });

    expect(line).toContain("Ada");
    expect(line).not.toContain(EMAIL);
  });

  it("masks an address embedded in a serialized error's value fields", () => {
    // PP-45qx: a mail-provider send failure carries the recipient in the error
    // `message`, `stack`, `rejected` array, `envelope.to` and `response` — none
    // under an email-named key, so the key-based redact list cannot reach it.
    // Modelled on a realistic nodemailer/Resend failure (the shape the bug was
    // reproduced with on PR #1866), not `Object.assign(new Error(), { email })`.
    const recipient = "victim@example.com";
    const error = Object.assign(
      new Error(`550 5.1.1 <${recipient}> recipient unknown`),
      {
        code: "EENVELOPE",
        rejected: [recipient],
        envelope: { from: "noreply@apc.example", to: [recipient] },
        response: `550 5.1.1 <${recipient}> recipient unknown`,
      }
    );

    const line = logLine({ err: error });

    // No raw recipient anywhere in the line — message, stack, or provider field.
    expect(line).not.toContain(recipient);
    // The diagnostic survives: address masked (not blanked), code and SMTP text
    // intact for debugging.
    expect(line).toContain("vic***");
    expect(line).toContain("550 5.1.1");
    expect(line).toContain("EENVELOPE");
  });

  it("leaves an error carrying no address untouched", () => {
    const error = Object.assign(new Error("connection refused"), {
      code: "ECONNREFUSED",
    });

    const line = logLine({ err: error });

    expect(line).toContain("connection refused");
    expect(line).toContain("ECONNREFUSED");
  });

  it("masks an address on an internationalised (non-ASCII) domain", () => {
    // An ASCII-only pattern stops at the first non-ASCII byte and leaks the
    // whole address; the `u`-flagged, delimiter-based regex matches by code
    // point so an IDN domain is caught.
    const error = new Error("bounce for user@exämple.com");

    const line = logLine({ err: error });

    expect(line).not.toContain("user@exämple.com");
    expect(line).toContain("use***");
  });

  it("masks an address nested far deeper than any redact wildcard reaches", () => {
    // No depth cap: a string is masked at any nesting. `detail` is a neutral key
    // so only the serializer (not the key-based redact list) can catch it, which
    // proves the value-masking reaches all the way down.
    let node: Record<string, unknown> = {
      detail: "reject victim@example.com",
    };
    for (let i = 0; i < 12; i += 1) node = { child: node };
    const error = Object.assign(new Error("deep"), { chain: node });

    const line = logLine({ err: error });

    expect(line).not.toContain("victim@example.com");
    expect(line).toContain("vic***");
  });

  it("preserves a non-plain-object field (Date) rather than blanking it", () => {
    // In-place masking keeps value identity: a Date serializes to its ISO string
    // as before, not to `{}` (which a rebuild-from-keys would produce).
    const occurredAt = new Date("2020-01-02T03:04:05.000Z");
    const error = Object.assign(new Error("boom"), { occurredAt });

    const line = logLine({ err: error });

    expect(line).toContain("2020-01-02T03:04:05.000Z");
  });

  it("does not crash on a self-referential error value", () => {
    interface Box {
      note: string;
      self?: Box;
    }
    const box: Box = { note: "to victim@example.com" };
    box.self = box;
    const error = Object.assign(new Error("cycle"), { box });

    const line = logLine({ err: error });

    expect(line).not.toContain("victim@example.com");
    expect(line).toContain("vic***");
  });
});
