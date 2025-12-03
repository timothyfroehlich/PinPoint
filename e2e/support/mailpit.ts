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
   * Get a specific message by ID
   */
  async getMessage(
    email: string,
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
    const timeout = criteria.timeout ?? 10000; // 10 seconds default
    const interval = criteria.pollIntervalMs ?? 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const messages = await this.getMessages(email);

      const match = messages.find((msg) => {
        if (criteria.subject && msg.Subject !== criteria.subject) {
          return false;
        }
        if (
          criteria.subjectContains &&
          !msg.Subject.includes(criteria.subjectContains)
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
   * Extract password reset link from the latest email for a mailbox
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
    const html = (detail.HTML ?? detail.Text ?? "").toString();
    const match = PASSWORD_RESET_LINK_REGEX.exec(html);
    if (!match?.[1]) {
      throw new Error("Password reset link not found in email body");
    }
    return decodeHtmlEntities(match[1]);
  }

  /**
   * Delete all messages for a specific email
   */
  async clearMailbox(email: string): Promise<void> {
    // Mailpit does not support mailbox-scoped delete; use global delete for test isolation.
    await this.deleteAllMessages();
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

const PASSWORD_RESET_LINK_REGEX = /href="([^"]*\/auth\/v1\/verify[^"]*)"/i;

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
    await mailpitClient.clearMailbox(email);
    return;
  }
  await mailpitClient.deleteAllMessages();
};

export const getPasswordResetLink = async (email: string): Promise<string> =>
  mailpitClient.getPasswordResetLink(email);

export const waitForEmail = async (
  email: string,
  criteria: {
    subject?: string;
    subjectContains?: string;
    timeout?: number;
  } = {}
) => mailpitClient.waitForEmail(email, criteria);
