/**
 * Mailpit email testing utilities for E2E tests
 *
 * Supabase now ships Mailpit under the legacy "inbucket" section name.
 * We prefer MAILPIT_* env vars but keep INBUCKET_* as a compatibility alias.
 */

interface MailpitRecipient {
  Name?: string;
  Address: string;
}

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: MailpitRecipient[];
  From?: MailpitRecipient;
  Date?: string;
  // Convenience normalized fields for tests
  id?: string;
  subject?: string;
  to?: string[];
}

type MailpitMessageDetail = MailpitMessage & {
  HTML?: string;
  Text?: string;
};

export class MailpitClient {
  public readonly apiUrl: string;

  constructor() {
    const port =
      process.env.MAILPIT_PORT ?? process.env.INBUCKET_PORT ?? "54324";
    this.apiUrl = `http://127.0.0.1:${port}/api/v1`;
  }

  /**
   * Get all messages for a mailbox
   */
  async getMessages(email: string): Promise<MailpitMessage[]> {
    const response = await fetch(
      `${this.apiUrl}/messages?query=addressed:"${email}"`
    );
    if (!response.ok) {
      if (response.status === 404) {
        return []; // Tolerate 404 as empty mailbox
      }
      throw new Error(
        `Failed to fetch messages: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as
      | { messages: MailpitMessage[] }
      | MailpitMessage[]
      | { items: MailpitMessage[] };

    const list: MailpitMessage[] = Array.isArray(data)
      ? data
      : "messages" in data
        ? data.messages
        : "items" in data
          ? data.items
          : [];

    return list.map((msg) => ({
      ...msg,
      id: msg.ID,
      subject: msg.Subject,
      to: msg.To.map((r) => r.Address),
    }));
  }

  /**
   * Get the latest message for a mailbox
   */
  async getLastEmail(email: string): Promise<MailpitMessage | null> {
    const messages = await this.getMessages(email);
    if (messages.length === 0) {
      return null;
    }
    // Sort by date descending and return the latest
    const sorted = messages.sort(
      (a, b) =>
        new Date(b.Date ?? 0).getTime() - new Date(a.Date ?? 0).getTime()
    );
    return sorted[0] ?? null;
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(
    _email: string,
    messageId: string
  ): Promise<MailpitMessageDetail> {
    const response = await fetch(`${this.apiUrl}/message/${messageId}`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch message ${messageId}: ${response.statusText}`
      );
    }

    const detail = (await response.json()) as MailpitMessageDetail;
    return {
      ...detail,
      id: detail.ID,
      subject: detail.Subject,
      to: detail.To.map((r) => r.Address),
    };
  }

  /**
   * Wait for an email matching criteria to arrive
   */
  async waitForEmail(
    email: string,
    criteria: {
      subject?: string;
      subjectContains?: string;
      timeout?: number;
      pollIntervalMs?: number;
    } = {}
  ): Promise<MailpitMessage | null> {
    const timeout = criteria.timeout ?? 30000;
    const interval = criteria.pollIntervalMs ?? 750;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const allMessages = await this.getMessages(email);

      // Filter messages to ensure they are addressed to the specific email
      // and match the other criteria. This is extra defensive against Mailpit
      // query broadness.
      const match = allMessages.find((msg) => {
        const isToRecipient = msg.to.some(
          (addr) => addr.toLowerCase() === email.toLowerCase()
        );
        if (!isToRecipient) return false;

        if (criteria.subject && msg.Subject !== criteria.subject) {
          return false;
        }
        if (
          criteria.subjectContains &&
          !msg.Subject.toLowerCase().includes(
            criteria.subjectContains.toLowerCase()
          )
        ) {
          return false;
        }
        return true;
      });

      if (match) {
        return match;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return null;
  }

  /**
   * Extract signup link from the latest email for a mailbox
   */
  async getSignupLink(email: string): Promise<string> {
    console.log(`[Mailpit] Looking for invite email to ${email}...`);
    const latest = await this.waitForEmail(email, {
      subjectContains: "Invite",
      timeout: 30000,
      pollIntervalMs: 750,
    });

    if (!latest) {
      console.log(`[Mailpit] No invite email found after waiting`);
      // Try to get ALL messages to debug
      const allMessages = await this.getMessages(email);
      console.log(
        `[Mailpit] Total messages for ${email}: ${allMessages.length}`
      );
      allMessages.forEach((msg) => {
        console.log(`[Mailpit]   - ${msg.Subject} (${msg.ID})`);
      });
      throw new Error(`No invite messages found for ${email}`);
    }

    console.log(
      `[Mailpit] Found invite email: ${latest.Subject} (${latest.ID})`
    );
    const detail = await this.getMessage(email, latest.ID);
    const html = (detail.HTML ?? detail.Text ?? "").toString();
    const match = /href="([^"]*\/signup\?email=[^"]*)"/i.exec(html);
    if (!match?.[1]) {
      throw new Error("Signup link not found in email body");
    }
    return decodeHtmlEntities(match[1]);
  }

  /**
   * Extract password reset link from the latest email for a mailbox.
   *
   * Tries multiple extraction strategies in order:
   * 1. href attribute in HTML body containing /verify with type=recovery
   *    (current Supabase GoTrue format — the path is /verify, not
   *    /auth/v1/verify; type=recovery disambiguates from signup/invite emails)
   * 2. Any URL containing /verify with type=recovery in either body part
   * 3. Any URL containing /auth/callback (defensive coverage for future
   *    format drift where the callback URL appears directly in the email)
   *
   * Logs the full email body and headers on failure so CI flakes are diagnosable.
   */
  async getPasswordResetLink(email: string): Promise<string> {
    const latest =
      (await this.waitForEmail(email, {
        subjectContains: "Reset",
        timeout: 30000,
        pollIntervalMs: 750,
      })) ??
      (await this.waitForEmail(email, {
        timeout: 30000,
        pollIntervalMs: 750,
      }));

    if (!latest) {
      throw new Error(`No messages found for ${email}`);
    }

    const detail = await this.getMessage(email, latest.ID);
    const htmlBody = (detail.HTML ?? "").toString();
    const textBody = (detail.Text ?? "").toString();

    // Strategy 1: href in HTML containing /verify?...type=recovery
    const hrefMatch = PASSWORD_RESET_LINK_REGEX.exec(htmlBody);
    if (hrefMatch?.[1]) {
      return decodeHtmlEntities(hrefMatch[1]);
    }

    // Strategy 2: bare URL containing /verify with type=recovery — search
    // both bodies independently so a non-empty HTML part doesn't hide a
    // text-only link
    const verifyPattern =
      /https?:\/\/[^\s"'<>)]*\/verify\?[^\s"'<>)]*type=recovery[^\s"'<>)]*/i;
    const verifyUrlMatch =
      verifyPattern.exec(htmlBody) ?? verifyPattern.exec(textBody);
    if (verifyUrlMatch?.[0]) {
      return decodeHtmlEntities(verifyUrlMatch[0]);
    }

    // Strategy 3: direct callback URL — defensive coverage for future
    // Supabase formats that embed the /auth/callback URL directly with
    // token_hash or code params. Search both bodies independently.
    const callbackPattern =
      /https?:\/\/[^\s"'<>)]*\/auth\/callback[^\s"'<>)]*/i;
    const callbackUrlMatch =
      callbackPattern.exec(htmlBody) ?? callbackPattern.exec(textBody);
    if (callbackUrlMatch?.[0]) {
      return decodeHtmlEntities(callbackUrlMatch[0]);
    }

    // All strategies failed — log diagnostics so future CI flakes are diagnosable.
    // Redact one-time token values to avoid leaking secrets into logs.
    const redactTokens = (s: string): string =>
      s
        .replace(/([?&]token=)[^&"'\s<>)]+/gi, "$1[REDACTED]")
        .replace(/([?&]token_hash=)[^&"'\s<>)]+/gi, "$1[REDACTED]")
        .replace(/([?&]code=)[^&"'\s<>)]+/gi, "$1[REDACTED]");
    console.error(
      `[Mailpit] Password reset link not found.\n` +
        `  Message ID: ${detail.ID}\n` +
        `  Subject: ${detail.Subject}\n` +
        `  To: ${detail.To.map((r) => r.Address).join(", ")}\n` +
        `  Date: ${detail.Date ?? "(unknown)"}\n` +
        `  HTML body (${htmlBody.length} chars):\n${redactTokens(htmlBody) || "(empty)"}\n` +
        `  Text body (${textBody.length} chars):\n${redactTokens(textBody) || "(empty)"}`
    );

    throw new Error("Password reset link not found in email body");
  }

  /**

     * Delete all messages for a specific email

     */

  clearMailbox(email: string): void {
    // Mailpit does not support mailbox-scoped delete.

    // For test isolation in parallel runs, we should avoid global deletes.

    // Tests should instead rely on unique subjects or timestamps.

    console.log(
      `[Mailpit] clearMailbox(${email}) called (no-op for parallel stability)`
    );
  }

  /**
   * Delete a specific message by ID
   */
  async deleteMessage(messageId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/message/${messageId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(
        `Failed to delete message ${messageId}: ${response.status} ${response.statusText}`
      );
    }
  }

  /**
   * Delete all messages across all mailboxes
   */
  async deleteAllMessages(): Promise<void> {
    const response = await fetch(`${this.apiUrl}/messages`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to clear all messages: ${response.status} ${response.statusText}`
      );
    }
  }
}

// Match href attributes that point to a /verify URL with type=recovery.
// Current Supabase GoTrue serves password reset links from /verify (no
// /auth/v1/ prefix). type=recovery disambiguates from signup/invite emails
// that also use /verify but with type=signup or type=invite.
const PASSWORD_RESET_LINK_REGEX =
  /href="(http[^"]*\/verify\?[^"]*type=recovery[^"]*)"/i;

const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const mailpitClient = new MailpitClient();

export const deleteAllMessages = async (email?: string): Promise<void> => {
  if (email) {
    mailpitClient.clearMailbox(email);
    return;
  }
  await mailpitClient.deleteAllMessages();
};

export const getPasswordResetLink = async (email: string): Promise<string> =>
  mailpitClient.getPasswordResetLink(email);

export const getSignupLink = async (email: string): Promise<string> =>
  mailpitClient.getSignupLink(email);

export const waitForEmail = async (
  email: string,
  criteria: {
    subject?: string;
    subjectContains?: string;
    timeout?: number;
  } = {}
) => mailpitClient.waitForEmail(email, criteria);

export const getLastEmail = async (email: string) =>
  mailpitClient.getLastEmail(email);
