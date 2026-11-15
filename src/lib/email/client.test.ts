import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type * as EmailClient from "./client";

/**
 * Unit tests for {@link sendEmail}, the single seam every email sender goes
 * through, with the Resend SDK mocked at its boundary (CORE-TEST-006).
 *
 * Regression under test is PP-f4w0 (Sentry PINPOINT-32): an issue title
 * containing a newline was interpolated into the notification subject, Resend
 * rejected the send ("The `\n` is not allowed in the `subject` field."), and
 * every email for that issue failed. sendEmail must hand the transport a
 * single-line subject whatever the caller built.
 */

const mockSend = vi.fn();

vi.mock("resend", () => ({
  // `new Resend(key)` must be constructable, so mock it as a class.
  Resend: class {
    emails = { send: mockSend };
  },
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
}));

// The transport is chosen once at module load from the environment, so pin
// the Resend path before importing (.env.local may point tests at Mailpit).
async function loadSendEmail(): Promise<typeof EmailClient.sendEmail> {
  vi.resetModules();
  vi.stubEnv("EMAIL_TRANSPORT", "resend");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  const { sendEmail } = await import("./client");
  return sendEmail;
}

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: "email_123" }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [
      "an LF",
      "[F14] PP-3: Left flipper\nweak",
      "[F14] PP-3: Left flipper weak",
    ],
    [
      "a CRLF",
      "[F14] PP-3: Left flipper\r\nweak",
      "[F14] PP-3: Left flipper weak",
    ],
    [
      "blank lines and tabs",
      "[F14] PP-3: Left flipper\n\n\tweak",
      "[F14] PP-3: Left flipper weak",
    ],
    [
      "other control characters",
      "[F14] PP-3: Left\u0000flipper\u0085weak",
      "[F14] PP-3: Left flipper weak",
    ],
    [
      "a trailing newline",
      "[F14] PP-3: Left flipper weak\n",
      "[F14] PP-3: Left flipper weak",
    ],
    [
      "a run of spaces",
      "[F14] PP-3: Left  flipper   weak",
      "[F14] PP-3: Left flipper weak",
    ],
    [
      "nothing to collapse",
      "[F14] PP-3: Left flipper weak",
      "[F14] PP-3: Left flipper weak",
    ],
  ])(
    "sends a single-line subject when the subject has %s",
    async (_case, subject, expected) => {
      const sendEmail = await loadSendEmail();

      const result = await sendEmail({
        to: "member@example.com",
        subject,
        html: "<p>hi</p>",
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expected }),
        {}
      );
    }
  );
});
