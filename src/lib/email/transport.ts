import { Resend } from "resend";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

export const EMAIL_FROM =
  "PinPoint <notifications@pinpoint.austinpinballcollective.org>";

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface EmailResult {
  success: boolean;
  data?: unknown;
  error?: unknown;
}

/**
 * Email transport interface
 * Allows swapping between Resend (production) and SMTP (testing)
 */
export interface EmailTransport {
  send(params: EmailParams): Promise<EmailResult>;
}

/**
 * Production email transport using Resend API
 */
export class ResendTransport implements EmailTransport {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send({ to, subject, html }: EmailParams): Promise<EmailResult> {
    try {
      const data = await this.client.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      });

      return { success: true, data };
    } catch (error) {
      console.error("❌ Failed to send email via Resend:", error);
      return { success: false, error };
    }
  }
}

/**
 * SMTP email transport for testing with Mailpit (formerly Inbucket)
 * Uses nodemailer to send emails to local SMTP server
 */
export class SMTPTransport implements EmailTransport {
  private transporter: Mail;

  constructor(config?: { host?: string; port?: number }) {
    const host = config?.host ?? "127.0.0.1";
    const port = config?.port ?? 1025; // Mailpit SMTP default port

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // Mailpit doesn't use TLS by default locally
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });
  }

  async send({ to, subject, html }: EmailParams): Promise<EmailResult> {
    try {
      const info = (await this.transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      })) as unknown;

      return { success: true, data: info };
    } catch (error) {
      console.error("❌ Failed to send email via SMTP:", error);
      return { success: false, error };
    }
  }
}
