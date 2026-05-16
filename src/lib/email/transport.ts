import "server-only";

import { Resend } from "resend";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { reportError } from "~/lib/observability/report-error";

export const EMAIL_FROM =
  "PinPoint <notifications@pinpoint.austinpinballcollective.org>";

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  /** RFC 5322 In-Reply-To header value (e.g. "<issue-PP-1234@pinpoint.app>") */
  inReplyTo?: string | undefined;
  /** RFC 5322 References header value (e.g. "<issue-PP-1234@pinpoint.app>") */
  references?: string | undefined;
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

  async send({
    to,
    subject,
    html,
    inReplyTo,
    references,
  }: EmailParams): Promise<EmailResult> {
    try {
      // Build optional RFC 5322 threading headers.
      // Resend supports arbitrary custom headers via the `headers` field.
      const headers: Record<string, string> = {};
      if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
      if (references) headers["References"] = references;

      const data = await this.client.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        html,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      });

      return { success: true, data };
    } catch (error) {
      reportError(error, { action: "ResendTransport.send" });
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

  async send({
    to,
    subject,
    html,
    inReplyTo,
    references,
  }: EmailParams): Promise<EmailResult> {
    try {
      const info = (await this.transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        html,
        ...(inReplyTo ? { inReplyTo } : {}),
        ...(references ? { references } : {}),
      })) as unknown;

      return { success: true, data: info };
    } catch (error) {
      reportError(error, { action: "SMTPTransport.send" });
      return { success: false, error };
    }
  }
}
