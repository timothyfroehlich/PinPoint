import { describe, it, expect, vi, beforeEach } from "vitest";

import { ResendTransport } from "./transport";

/**
 * Unit tests for {@link ResendTransport}, mocking the Resend SDK at its
 * boundary (CORE-TEST-006). The regression under test is PP-okmw: the Resend
 * SDK does not throw on API-level send failures — it resolves with
 * `{ data: null, error: {...} }` — so a rejected send was being reported as a
 * success and never logged. SMTPTransport's live path is covered by the
 * Mailpit integration test; here we only need the Resend response handling.
 *
 * The transport returns a failure Result but does NOT call reportError itself
 * (PP-l4fd): `sendEmail` (client.ts) is the single report site, so a failure is
 * captured exactly once. The `reportError` assertions below guard against a
 * regression that re-adds self-reporting to the transport.
 */

const mockSend = vi.fn();

vi.mock("resend", () => ({
  // `new Resend(key)` must be constructable, so mock it as a class rather than
  // an arrow-returning vi.fn (which is not newable).
  Resend: class {
    emails = { send: mockSend };
  },
}));

const mockReportError = vi.fn();
vi.mock("~/lib/observability/report-error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

const params = {
  to: "member@example.com",
  subject: "Issue update",
  html: "<p>hi</p>",
};

describe("ResendTransport.send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success and the created email data when Resend resolves with data", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_123" }, error: null });

    const result = await new ResendTransport("key").send(params);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: "email_123" });
    expect(result.error).toBeUndefined();
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it("returns a failure Result (without self-reporting) when Resend resolves with an error (no throw)", async () => {
    // This is the PP-okmw case: the promise RESOLVES (never rejects), so the
    // catch block is never reached. The pre-fix code returned success here.
    const resendError = {
      name: "validation_error",
      message: "Invalid `to` field.",
    };
    mockSend.mockResolvedValue({ data: null, error: resendError });

    const result = await new ResendTransport("key").send(params);

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toContain("Invalid `to` field.");
    // Original Resend error preserved (by reference) as the cause for context.
    expect((result.error as Error).cause).toBe(resendError);
    // sendEmail is the sole report site; the transport must not report. (PP-l4fd)
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it("returns a failure Result (without self-reporting) when the SDK genuinely throws", async () => {
    const thrown = new Error("network down");
    mockSend.mockRejectedValue(thrown);

    const result = await new ResendTransport("key").send(params);

    expect(result.success).toBe(false);
    expect(result.error).toBe(thrown);
    // sendEmail is the sole report site; the transport must not report. (PP-l4fd)
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it("forwards threading and idempotency options to the SDK", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_456" }, error: null });

    await new ResendTransport("key").send({
      ...params,
      inReplyTo: "<issue-PP-1@pinpoint>",
      references: "<issue-PP-1@pinpoint>",
      idempotencyKey: "key-abc",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          "In-Reply-To": "<issue-PP-1@pinpoint>",
          References: "<issue-PP-1@pinpoint>",
        },
      }),
      { idempotencyKey: "key-abc" }
    );
  });
});
