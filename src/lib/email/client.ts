import {
  type EmailTransport,
  type EmailParams,
  type EmailResult,
  ResendTransport,
  SMTPTransport,
  EMAIL_FROM,
} from "./transport";

// Re-export for backward compatibility
export { EMAIL_FROM };

/**
 * Initialize email transport based on environment
 * - Production/Dev: Uses Resend API if RESEND_API_KEY is set
 * - Testing: Uses SMTP (Mailpit) if EMAIL_TRANSPORT=smtp
 * - Fallback: No transport (logs warnings)
 */
function createTransport(): EmailTransport | null {
  const shouldUseSmtp =
    process.env["EMAIL_TRANSPORT"] === "smtp" ||
    (!process.env["RESEND_API_KEY"] &&
      Boolean(
        process.env["MAILPIT_PORT"] ??
        process.env["MAILPIT_SMTP_PORT"] ??
        process.env["INBUCKET_PORT"] ??
        process.env["INBUCKET_SMTP_PORT"]
      ));

  if (shouldUseSmtp) {
    const port = (() => {
      const raw =
        process.env["MAILPIT_SMTP_PORT"] ??
        process.env["INBUCKET_SMTP_PORT"] ??
        process.env["MAILPIT_PORT"] ??
        process.env["INBUCKET_PORT"];
      return raw ? parseInt(raw, 10) : 57325;
    })();

    return new SMTPTransport({ port });
  }

  // Production/Dev: use Resend if API key is present
  const apiKey = process.env["RESEND_API_KEY"];
  if (apiKey) {
    return new ResendTransport(apiKey);
  }

  // No transport configured
  return null;
}

const transport = createTransport();

export async function sendEmail({
  to,
  subject,
  html,
}: EmailParams): Promise<EmailResult> {
  if (!transport) {
    console.warn("⚠️ No email transport configured. Email not sent:", {
      to,
      subject,
    });
    return { success: false, error: "No transport configured" };
  }

  return transport.send({ to, subject, html });
}
