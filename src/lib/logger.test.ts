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
    // A Date serializes through its own `toJSON` to the ISO string, not to `{}`
    // (which a blind rebuild-from-keys would produce).
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

  it("masks (and does not throw on) a frozen nested error value", () => {
    // Mutating a frozen value in place throws; pino does not catch serializer
    // errors, so that would turn a logged failure into a new crash. Rebuilding
    // reads the frozen value without assigning into it.
    const error = Object.assign(new Error("boom"), {
      envelope: Object.freeze({ to: ["victim@example.com"] }),
    });

    const line = logLine({ err: error });

    expect(line).not.toContain("victim@example.com");
    expect(line).toContain("vic***");
  });

  it("does not crash on a throwing getter nested in the error", () => {
    const detail: Record<string, unknown> = {};
    Object.defineProperty(detail, "info", {
      enumerable: true,
      get() {
        throw new Error("cannot read");
      },
    });
    const error = Object.assign(new Error("boom"), { code: "EFAIL", detail });

    const line = logLine({ err: error });

    expect(line).toContain("EFAIL");
    expect(line).toContain("[unserializable]");
  });

  it("does not shred a stack-trace path that merely contains an @", () => {
    // pnpm's `.pnpm/@scope+pkg@version/` layout embeds `@` in every node_modules
    // frame; the alphabetic-TLD anchor keeps the masker off them.
    const frame =
      "at x (/app/node_modules/.pnpm/@vitest+runner@4.1.10/node_modules/@vitest/runner/dist/x.js:1:2)";
    const error = new Error(frame);

    const line = logLine({ err: error });

    expect(line).toContain("@vitest+runner@4.1.10");
    expect(line).not.toContain("***");
  });

  it("terminates on a branching cycle instead of fanning out exponentially", () => {
    // A depth cap alone does not bound total work: `n.left = n; n.right = n`
    // duplicates both paths at every level (~2^depth visits) before the cap is
    // reached. The visited-set guard short-circuits the repeat immediately, so
    // this returns rather than hanging the event loop while reporting an error.
    interface Node {
      note: string;
      left?: Node;
      right?: Node;
    }
    const node: Node = { note: "reject victim@example.com" };
    node.left = node;
    node.right = node;
    const error = Object.assign(new Error("cyclic"), { node });

    const line = logLine({ err: error });

    expect(line).not.toContain("victim@example.com");
    expect(line).toContain("vic***");
  });

  it("serializes a value through its toJSON rather than exposing backing fields", () => {
    // An SDK class whose `toJSON` exposes only a redacted summary must not have
    // its hidden fields flattened into the log by a blind key-walk.
    const creds = {
      token: "supersecrettoken",
      toJSON: () => ({ summary: "credentials (redacted)" }),
    };
    const error = Object.assign(new Error("auth failed"), { creds });

    const line = logLine({ err: error });

    expect(line).toContain("credentials (redacted)");
    expect(line).not.toContain("supersecrettoken");
  });

  it("renders a slot-backed object (URL) via toJSON, not as {}", () => {
    const error = Object.assign(new Error("bad endpoint"), {
      endpoint: new URL("https://api.example.com/v1/x"),
    });

    const line = logLine({ err: error });

    expect(line).toContain("api.example.com/v1/x");
  });

  it("masks the full local part of an address containing an apostrophe", () => {
    // An apostrophe is valid in an unquoted local part; excluding it would match
    // only `hara@…` and leave `o'har***` (five of six chars) in the log.
    const error = new Error(`bounce for ${"o"}'hara@example.com`);

    const line = logLine({ err: error });

    expect(line).not.toContain("o'hara@example.com");
    expect(line).toContain("o'h***");
    expect(line).not.toContain("o'har***");
  });

  it("scans a long malformed email-like token in bounded time", () => {
    // A huge `aaaa…@bbbb…` token with no TLD backtracks quadratically from every
    // start position without a boundary anchor; the lookbehind rejects interior
    // positions in O(1), keeping the scan linear so logging malformed provider
    // metadata cannot block the event loop.
    const token = `${"a".repeat(40_000)}@${"b".repeat(40_000)}`;
    const error = new Error(`response: ${token}`);

    const start = performance.now();
    const line = logLine({ err: error });
    const elapsedMs = performance.now() - start;

    // Generous bound: anchored scan is ~1ms; the unanchored regex took ~6600ms.
    expect(elapsedMs).toBeLessThan(1000);
    expect(line).toContain('"msg":"test"');
  });

  it("masks an overlong local part in full rather than a suffix", () => {
    // The boundary anchor means matching starts at the token's first character,
    // so a >64-char local part is masked whole (three-char disclosure) instead
    // of leaking its leading characters before a suffix match.
    const localPart = "a".repeat(77);
    const error = new Error(`bounce for ${localPart}@example.com`);

    const line = logLine({ err: error });

    expect(line).toContain("aaa***");
    // No run of raw local-part characters survives ahead of the mask.
    expect(line).not.toContain("aaaa***");
    expect(line).not.toContain("aaaaaaaaaa"); // 10 raw chars would signal a leak
  });
});
