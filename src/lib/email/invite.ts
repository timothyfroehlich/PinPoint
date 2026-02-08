import { sendEmail } from "./client";
import { escapeHtml } from "~/lib/markdown";

interface InviteEmailParams {
  to: string;
  firstName: string;
  inviterName: string;
  siteUrl: string;
}

export function renderInviteEmailHtml({
  firstName,
  inviterName,
  siteUrl,
  to,
}: InviteEmailParams): string {
  const signupUrl = `${siteUrl}/signup?email=${encodeURIComponent(to)}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #0070f3;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>You've been invited to PinPoint!</h2>
          <p>Hi ${escapeHtml(firstName)},</p>
          <p>
            ${escapeHtml(inviterName)} has added you as an owner of pinball machines in PinPoint, the
            issue tracking system for Austin Pinball Collective.
          </p>
          <p><strong>Create your account to get started:</strong></p>
          <a href="${signupUrl}" class="button">Create Account</a>
          <p>Once you sign up, you'll be able to:</p>
          <ul>
            <li>View and manage issues for your machines</li>
            <li>Receive notifications about new issues</li>
            <li>Track repair history</li>
          </ul>
          <p>Questions? Reply to this email.</p>
          <p>— The PinPoint Team</p>
        </div>
      </body>
    </html>
  `;
}

export function renderInviteEmailText({
  firstName,
  inviterName,
  siteUrl,
  to,
}: InviteEmailParams): string {
  const signupUrl = `${siteUrl}/signup?email=${encodeURIComponent(to)}`;

  return `
You've been invited to PinPoint!

Hi ${firstName},

${inviterName} has added you as an owner of pinball machines in PinPoint, the issue tracking system for Austin Pinball Collective.

Create your account to get started:
${signupUrl}

Once you sign up, you'll be able to:
- View and manage issues for your machines
- Receive notifications about new issues
- Track repair history

Questions? Reply to this email.

— The PinPoint Team
  `.trim();
}

export async function sendInviteEmail(
  params: InviteEmailParams
): Promise<{ success: boolean; error?: unknown }> {
  const html = renderInviteEmailHtml(params);
  // Note: sendEmail currently only takes html, so we'll just pass that for now.
  // The client/transport could be updated to support text if needed.
  return sendEmail({
    to: params.to,
    subject: "You've been invited to PinPoint",
    html,
  });
}
