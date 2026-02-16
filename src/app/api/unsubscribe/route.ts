import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { notificationPreferences } from "~/server/db/schema";
import { verifyUnsubscribeToken } from "~/lib/notification-formatting";

export function GET(request: NextRequest): NextResponse {
  const uid = request.nextUrl.searchParams.get("uid");
  const token = request.nextUrl.searchParams.get("token");

  if (!uid || !token) {
    return htmlResponse("Invalid unsubscribe link.", 400);
  }

  if (!verifyUnsubscribeToken(uid, token)) {
    return htmlResponse("Invalid or expired unsubscribe link.", 403);
  }

  // GET is intentionally non-mutating to avoid accidental unsubscribes
  // from email link scanners or browser prefetching.
  return htmlResponse(renderConfirmation(uid, token), 200, true);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const uid = formData.get("uid");
  const token = formData.get("token");

  if (typeof uid !== "string" || typeof token !== "string" || !uid || !token) {
    return htmlResponse("Invalid unsubscribe request.", 400);
  }

  if (!verifyUnsubscribeToken(uid, token)) {
    return htmlResponse("Invalid or expired unsubscribe link.", 403);
  }

  const result = await db
    .update(notificationPreferences)
    .set({
      emailEnabled: false,
      emailNotifyOnAssigned: false,
      emailNotifyOnStatusChange: false,
      emailNotifyOnNewComment: false,
      emailNotifyOnNewIssue: false,
      emailWatchNewIssuesGlobal: false,
      emailNotifyOnMachineOwnershipChange: false,
    })
    .where(eq(notificationPreferences.userId, uid))
    .returning({ userId: notificationPreferences.userId });

  if (result.length === 0) {
    return htmlResponse("User not found.", 404);
  }

  return htmlResponse(
    "You have been unsubscribed from all PinPoint email notifications. " +
      'You can re-enable them anytime from your <a href="/settings">notification settings</a>.',
    200
  );
}

function htmlResponse(
  body: string,
  status: number,
  isHtml = false
): NextResponse {
  const content = isHtml ? body : `<p>${body}</p>`;
  return new NextResponse(renderHtml(content), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderConfirmation(uid: string, token: string): string {
  const escapedUid = escapeHtml(uid);
  const escapedToken = escapeHtml(token);

  return `
    <h2>Unsubscribe from PinPoint emails?</h2>
    <p>This will turn off all email notifications for your account.</p>
    <form method="post" action="/api/unsubscribe">
      <input type="hidden" name="uid" value="${escapedUid}" />
      <input type="hidden" name="token" value="${escapedToken}" />
      <button type="submit">Confirm unsubscribe</button>
    </form>
    <p style="margin-top: 12px;">
      <a href="/settings">Cancel and return to settings</a>
    </p>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtml(contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PinPoint — Unsubscribe</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 16px; color: #333; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>PinPoint</h1>
  ${contentHtml}
</body>
</html>`;
}
