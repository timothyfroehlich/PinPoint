import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SMTPTransport } from "~/lib/email/transport";

/**
 * Integration tests for email transport
 *
 * Tests that SMTP transport (Mailpit) is working correctly.
 * Requires Supabase to be running (which includes Mailpit under the legacy [inbucket] section).
 *
 * This allows E2E tests to verify actual email delivery.
 */

const loadMailpitPorts = async (): Promise<{
  apiPort?: string;
  smtpPort?: string;
}> => {
  try {
    const configPath = join(process.cwd(), "supabase/config.toml");
    const contents = await readFile(configPath, "utf8");
    const inbucketBlock = contents.split("[inbucket]")[1]?.split("[")[0] ?? "";
    const apiPort = /port\s*=\s*(\d+)/.exec(inbucketBlock)?.[1];
    const smtpPort = /smtp_port\s*=\s*(\d+)/.exec(inbucketBlock)?.[1];
    return { apiPort, smtpPort };
  } catch {
    return {};
  }
};

describe("Email Transport Integration", () => {
  let mailpitApiPort = process.env.MAILPIT_PORT ?? process.env.INBUCKET_PORT;
  let mailpitSmtpPort =
    process.env.MAILPIT_SMTP_PORT ?? process.env.INBUCKET_SMTP_PORT;
  let mailpitApiUrl = "";

  beforeAll(() => {
    return (async () => {
      const ports = await loadMailpitPorts();
      mailpitApiPort =
        mailpitApiPort ?? ports.apiPort ?? ports.smtpPort ?? "57324";
      mailpitSmtpPort = mailpitSmtpPort ?? ports.smtpPort ?? "57325";
      mailpitApiUrl = `http://127.0.0.1:${mailpitApiPort}/api/v1`;

      // Static worktrees: 54xxx-57xxx, ephemeral worktrees: 58xxx-63xxx
      expect(mailpitApiPort).toMatch(/[5-6]\d{4}/);
    })();
  });

  it("should send email via SMTP transport", async () => {
    const transport = new SMTPTransport({
      port: parseInt(mailpitSmtpPort ?? "57325", 10),
    });

    const result = await transport.send({
      to: "test@example.com",
      subject: "Test Email from SMTP Transport",
      html: "<p>This is a test email</p>",
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should make email available in Mailpit API", async () => {
    const transport = new SMTPTransport({
      port: parseInt(mailpitSmtpPort ?? "57325", 10),
    });

    // Send unique email
    const uniqueId = Date.now();
    const testEmail = `test-${uniqueId}@example.com`;
    const testSubject = `Integration Test ${uniqueId}`;

    await transport.send({
      to: testEmail,
      subject: testSubject,
      html: "<p>Integration test email</p>",
    });

    // Wait a bit for Mailpit to process
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check Mailpit API for the email
    // Mailpit API: /api/v1/messages
    const response = await fetch(`${mailpitApiUrl}/messages`);
    expect(response.ok).toBe(true);

    const data = (await response.json()) as unknown;

    // Mailpit API can return { messages: [...] } or just [...]
    interface MailpitMessage {
      Subject: string;
      To: { Address: string }[];
    }

    let messages: MailpitMessage[] = [];

    if (
      typeof data === "object" &&
      data !== null &&
      "messages" in data &&
      Array.isArray((data as { messages: unknown }).messages)
    ) {
      messages = (data as { messages: MailpitMessage[] }).messages;
    } else if (Array.isArray(data)) {
      messages = data as MailpitMessage[];
    }

    expect(messages).toBeDefined();
    expect(Array.isArray(messages)).toBe(true);

    // Find our test email
    const testMessage = messages.find((msg) => msg.Subject === testSubject);
    expect(testMessage).toBeDefined();
    expect(testMessage?.Subject).toBe(testSubject);
  });
});
