import "server-only";

import { Resend } from "resend";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

export const EMAIL_FROM =
  "PinPoint <notifications@pinpoint.austinpinballcollective.org>";

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  /** RFC 5322 In-Reply-To header value (e.g. "<issue-PP-1234@pinpoint.austinpinballcollective.org>") */
  inReplyTo?: string | undefined;
  /** RFC 5322 References header value (e.g. "<issue-PP-1234@pinpoint.austinpinballcollective.org>") */
  references?: string | undefined;
  /**
   * Idempotency key sent to Resend as the `Idempotency-Key` header. A retried
   * post-commit dispatch that produces the same key is deduped by Resend (24h
   * window) so the recipient is not double-emailed. Derived deterministically
   * per recipient + resource + notification type. (PP-2053.7)
   */
  idempotencyKey?: string | undefined;
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
    idempotencyKey,
  }: EmailParams): Promise<EmailResult> {
    try {
      // Build optional RFC 5322 threading headers.
      // Resend supports arbitrary custom headers via the `headers` field.
      const headers: Record<string, string> = {};
      if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
      if (references) headers["References"] = references;

      // The Resend SDK does NOT throw on API-level send failures (invalid
      // recipient, unverified/bounced domain, validation errors). It resolves
      // with `{ data: null, error: {...} }`, so the response must be inspected
      // — only genuine JS/network faults reach the catch block below. Without
      // this check a rejected send is reported as success and nothing is
      // logged: a member email silently never arrives. (PP-okmw)
      const { data, error } = await this.client.emails.send(
        {
          from: EMAIL_FROM,
          to,
          subject,
          html,
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        },
        // Resend dedupes retried sends carrying the same key (sent as the
        // `Idempotency-Key` header) within a 24h window. (PP-2053.7)
        idempotencyKey ? { idempotencyKey } : {}
      );

      if (error) {
        // Wrap the Resend error object in a real Error (with the original as
        // `cause`) so the single report at the sendEmail boundary gets a
        // message + stack — the Resend error is a plain object with neither.
        // Transports never call reportError themselves: sendEmail (client.ts)
        // is the sole report site, so a failure is captured exactly once.
        // (PP-okmw, PP-l4fd)
        return {
          success: false,
          error: new Error(`Resend rejected send: ${error.message}`, {
            cause: error,
          }),
        };
      }

      return { success: true, data };
    } catch (error) {
      // Reporting is done once by sendEmail on any !success result. (PP-l4fd)
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
      // Reporting is done once by sendEmail on any !success result. (PP-l4fd)
      return { success: false, error };
    }
  }
}
