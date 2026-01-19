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
        (process.env["MAILPIT_PORT"] ? "1025" : undefined) ??
        (process.env["INBUCKET_PORT"] ? "1025" : undefined);
      return raw ? parseInt(raw, 10) : 1025;
    })();

    console.log(`[Email] Using SMTP transport on port ${port}`);
    return new SMTPTransport({ port });
  }

  // Production/Dev: use Resend if API key is present
  const apiKey = process.env["RESEND_API_KEY"];
  if (apiKey) {
    console.log("[Email] Using Resend transport with API key");
    return new ResendTransport(apiKey);
  }

  // No transport configured
  console.warn(
    "[Email] ⚠️ No email transport configured - RESEND_API_KEY not found"
  );
  return null;
}

const transport = createTransport();

export async function sendEmail({
  to,
  subject,
  html,
}: EmailParams): Promise<EmailResult> {
  console.log(`[Email] Attempting to send email to ${to}: ${subject}`);

  if (!transport) {
    console.warn("⚠️ No email transport configured. Email not sent:", {
      to,
      subject,
    });
    return { success: false, error: "No transport configured" };
  }

  const result = await transport.send({ to, subject, html });
  if (result.success) {
    console.log(`✅ Email sent successfully to ${to}: ${subject}`);
  } else {
    console.error(`❌ Email failed to send to ${to}:`, result.error);
  }
  return result;
}
