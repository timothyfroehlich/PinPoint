/**
 * Mailpit email testing helpers
 *
 * Mailpit is configured in supabase/config.toml on port 54324.
 * It captures all emails sent by Supabase during local development.
 * (Replaces Inbucket in newer Supabase CLI versions)
 */

/// <reference lib="dom" />

const MAILPIT_URL = "http://127.0.0.1:54324";

interface MailpitMessage {
  ID: string;
  From: { Address: string };
  To: Array<{ Address: string }>;
  Subject: string;
  Created: string;
  Size: number;
  Snippet: string;
}

interface MailpitMessagesResponse {
  total: number;
  messages: MailpitMessage[];
}

interface MailpitMessageBody {
  HTML: string;
  Text: string;
}

/**
 * Get all messages for a specific email address with retry logic
 *
 * Handles cases when no messages exist yet (before first email arrives).
 * Retries with exponential backoff: 500ms, 1s, 1.5s, 2s, 2.5s
 */
export async function getMessages(
  email: string,
  retries = 5
): Promise<MailpitMessage[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);

    if (!response.ok) {
      // If API call fails, wait and retry
      if (attempt < retries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1))
        );
        continue;
      }
      // Last attempt failed, return empty array
      return [];
    }

    const data = (await response.json()) as MailpitMessagesResponse;

    // Filter messages for this email address
    const filtered = data.messages.filter((msg) =>
      msg.To.some((recipient) => recipient.Address === email)
    );

    // If we found messages, return them
    if (filtered.length > 0) {
      return filtered;
    }

    // No messages yet, retry
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  return [];
}

/**
 * Get a specific message body by ID
 */
export async function getMessageBody(
  messageId: string
): Promise<MailpitMessageBody> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Mailpit message body: ${response.status}`
    );
  }

  return (await response.json()) as MailpitMessageBody;
}

/**
 * Extract password reset link from Supabase email with retry logic
 *
 * Returns the full URL including token and type parameters.
 * Retries up to 6 times with exponential backoff: 500ms, 1s, 2s, 4s, 8s, 16s (~31.5s max wait total).
 */
export async function getPasswordResetLink(
  email: string
): Promise<string | null> {
  // Try up to 6 times with exponential backoff: 500ms * 2^attempt
  for (let attempt = 0; attempt < 6; attempt++) {
    const messages = await getMessages(email);

    // Find the password reset email
    const resetEmail = messages.find((msg) =>
      msg.Subject.toLowerCase().includes("reset")
    );

    if (resetEmail) {
      // Get the message body
      const body = await getMessageBody(resetEmail.ID);

      // Extract the Supabase verification link (contains redirect_to to our callback)
      const linkRegex = /href="([^"]*\/auth\/v1\/verify[^"]*)"/i;
      const linkMatch = linkRegex.exec(body.HTML);

      if (linkMatch?.[1]) {
        // Decode HTML entities (e.g., &amp; -> &)
        return linkMatch[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }
    }

    // Exponential backoff: 500ms * 2^attempt (500ms, 1s, 2s, 4s, 8s, 16s)
    if (attempt < 5) {
      const waitTime = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  return null;
}

/**
 * Delete all messages for an email address (cleanup)
 */
export async function deleteAllMessages(email: string): Promise<void> {
  // Mailpit uses DELETE /api/v1/messages to delete all messages
  await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: "DELETE",
  });
}
