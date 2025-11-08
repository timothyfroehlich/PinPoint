/**
 * Email Service using Resend
 *
 * Handles sending transactional emails including user invitations.
 * Uses Resend for reliable email delivery with Next.js optimization.
 */

import { Resend } from 'resend';
import { env } from '~/env';

// Initialize Resend client
const resend = new Resend(env.RESEND_API_KEY);

/**
 * Email send result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Invitation email parameters
 */
export interface InvitationEmailParams {
  to: string;
  organizationName: string;
  inviterName: string;
  roleName: string;
  token: string;
  expiresAt: Date;
  personalMessage?: string;
}

/**
 * Send invitation email to a new user
 *
 * @param params - Invitation email parameters
 * @returns Promise with email send result
 */
export async function sendInvitationEmail(
  params: InvitationEmailParams,
): Promise<EmailResult> {
  const {
    to,
    organizationName,
    inviterName,
    roleName,
    token,
    expiresAt,
    personalMessage,
  } = params;

  // Construct invitation acceptance URL
  const acceptUrl = `${env.NEXT_PUBLIC_BASE_URL}/auth/accept-invitation/${token}`;

  // Format expiration date
  const expiresFormatted = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: `${env.INVITATION_FROM_NAME} <${env.INVITATION_FROM_EMAIL}>`,
      to,
      subject: `You've been invited to join ${organizationName} on PinPoint`,
      html: renderInvitationEmailHtml({
        organizationName,
        inviterName,
        roleName,
        acceptUrl,
        expiresFormatted,
        personalMessage,
      }),
      text: renderInvitationEmailText({
        organizationName,
        inviterName,
        roleName,
        acceptUrl,
        expiresFormatted,
        personalMessage,
      }),
    });

    if (error) {
      console.error('Resend email send error:', error);
      return {
        success: false,
        error: error.message || 'Unknown email error',
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Email send exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Render invitation email HTML template
 */
function renderInvitationEmailHtml({
  organizationName,
  inviterName,
  roleName,
  acceptUrl,
  expiresFormatted,
  personalMessage,
}: {
  organizationName: string;
  inviterName: string;
  roleName: string;
  acceptUrl: string;
  expiresFormatted: string;
  personalMessage?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                PinPoint Invitation
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 20px; font-weight: 600;">
                Join ${organizationName}
              </h2>

              <p style="margin: 0 0 20px; color: #555555; font-size: 16px; line-height: 1.6;">
                ${inviterName} has invited you to join <strong>${organizationName}</strong> on PinPoint as a <strong>${roleName}</strong>.
              </p>

              ${personalMessage ? `
              <div style="margin: 0 0 30px; padding: 20px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
                <p style="margin: 0; color: #555555; font-size: 15px; line-height: 1.6; font-style: italic;">
                  "${personalMessage}"
                </p>
                <p style="margin: 10px 0 0; color: #888888; font-size: 13px;">
                  — ${inviterName}
                </p>
              </div>
              ` : ''}

              <!-- CTA Button -->
              <table role="presentation" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${acceptUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
                This invitation will expire on <strong>${expiresFormatted}</strong>.
              </p>

              <p style="margin: 20px 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
                If you have any questions, please contact ${inviterName}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; color: #888888; font-size: 13px; line-height: 1.6;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0; color: #667eea; font-size: 13px; word-break: break-all;">
                ${acceptUrl}
              </p>
              <p style="margin: 20px 0 0; color: #aaaaaa; font-size: 12px; line-height: 1.6;">
                You received this email because ${inviterName} invited you to join ${organizationName} on PinPoint.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Render invitation email plain text template
 */
function renderInvitationEmailText({
  organizationName,
  inviterName,
  roleName,
  acceptUrl,
  expiresFormatted,
  personalMessage,
}: {
  organizationName: string;
  inviterName: string;
  roleName: string;
  acceptUrl: string;
  expiresFormatted: string;
  personalMessage?: string;
}): string {
  return `
You've been invited to join ${organizationName} on PinPoint

${inviterName} has invited you to join ${organizationName} as a ${roleName}.

${personalMessage ? `\nPersonal message from ${inviterName}:\n"${personalMessage}"\n` : ''}

Accept your invitation:
${acceptUrl}

This invitation will expire on ${expiresFormatted}.

If you have any questions, please contact ${inviterName}.

---
You received this email because ${inviterName} invited you to join ${organizationName} on PinPoint.
  `.trim();
}
