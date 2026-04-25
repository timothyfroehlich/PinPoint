import {
  type EmailTransport,
  type EmailParams,
  type EmailResult,
  ResendTransport,
  SMTPTransport,
  EMAIL_FROM,
} from "./transport";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";

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

    log.info({ port }, "[Email] Using SMTP transport");
    return new SMTPTransport({ port });
  }

  // Production/Dev: use Resend if API key is present
  const apiKey = process.env["RESEND_API_KEY"];
  if (apiKey) {
    log.info({}, "[Email] Using Resend transport with API key");
    return new ResendTransport(apiKey);
  }

  // No transport configured
  log.warn(
    {},
    "[Email] No email transport configured - RESEND_API_KEY not found"
  );
  return null;
}

const transport = createTransport();

export async function sendEmail({
  to,
  subject,
  html,
}: EmailParams): Promise<EmailResult> {
  log.info({ to, subject }, "[Email] Attempting to send email");

  if (!transport) {
    log.warn(
      { to, subject },
      "[Email] No transport configured. Email not sent."
    );
    return { success: false, error: "No transport configured" };
  }

  const result = await transport.send({ to, subject, html });
  if (result.success) {
    log.info({ to, subject }, "[Email] Email sent successfully");
  } else {
    reportError(result.error, { action: "sendEmail", to, subject });
  }
  return result;
}
