import { Resend } from "resend";

const apiKey = process.env["RESEND_API_KEY"];

// Initialize Resend client only if API key is present
// This prevents crashes in development/test environments without the key
export const resend = apiKey ? new Resend(apiKey) : null;

export const EMAIL_FROM = "PinPoint <notifications@pinpoint.austinpinball.org>"; // Update with verified domain

interface SendEmailProps {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailProps): Promise<{
  success: boolean;
  data?: unknown;
  error?: unknown;
}> {
  if (!resend) {
    console.warn("⚠️ Resend API key not found. Email not sent:", {
      to,
      subject,
    });
    return { success: false, error: "Missing API Key" };
  }

  try {
    const data = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    return { success: true, data };
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    return { success: false, error };
  }
}
