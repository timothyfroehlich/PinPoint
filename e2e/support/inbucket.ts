/**
 * Inbucket email testing helpers
 *
 * Inbucket is configured in supabase/config.toml on port 54324.
 * It captures all emails sent by Supabase during local development.
 */

/// <reference lib="dom" />

const INBUCKET_URL = "http://127.0.0.1:54324";

interface InbucketMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  size: number;
}

interface InbucketMessageBody {
  body: {
    text: string;
    html: string;
  };
  header: Record<string, string[]>;
}

/**
 * Get all messages for a specific email address
 */
export async function getMessages(email: string): Promise<InbucketMessage[]> {
  // Inbucket uses the mailbox name (everything before @) as the key
  const mailbox = email.split("@")[0];

  const response = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch Inbucket messages: ${response.status}`);
  }

  const messages = (await response.json()) as InbucketMessage[];
  return messages;
}

/**
 * Get a specific message body by ID
 */
export async function getMessageBody(
  email: string,
  messageId: string
): Promise<InbucketMessageBody> {
  const mailbox = email.split("@")[0];

  const response = await fetch(
    `${INBUCKET_URL}/api/v1/mailbox/${mailbox}/${messageId}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Inbucket message body: ${response.status}`
    );
  }

  return (await response.json()) as InbucketMessageBody;
}

/**
 * Extract password reset link from Supabase email
 *
 * Returns the full URL including token and type parameters
 */
export async function getPasswordResetLink(
  email: string
): Promise<string | null> {
  // Wait a bit for email to arrive
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const messages = await getMessages(email);

  // Find the password reset email
  const resetEmail = messages.find((msg) =>
    msg.subject.toLowerCase().includes("reset")
  );

  if (!resetEmail) {
    return null;
  }

  // Get the message body
  const body = await getMessageBody(email, resetEmail.id);

  // Extract the reset link from the HTML body
  // Supabase sends a link like: http://localhost:3000/reset-password?token=...&type=recovery
  const linkRegex = /href="([^"]*reset-password[^"]*)"/i;
  const linkMatch = linkRegex.exec(body.body.html);

  if (!linkMatch?.[1]) {
    return null;
  }

  return linkMatch[1];
}

/**
 * Delete all messages for an email address (cleanup)
 */
export async function deleteAllMessages(email: string): Promise<void> {
  const mailbox = email.split("@")[0];

  await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`, {
    method: "DELETE",
  });
}
