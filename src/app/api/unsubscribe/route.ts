import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { notificationPreferences } from "~/server/db/schema";
import { verifyUnsubscribeToken } from "~/lib/notification-formatting";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const uid = request.nextUrl.searchParams.get("uid");
  const token = request.nextUrl.searchParams.get("token");

  if (!uid || !token) {
    return new NextResponse(renderHtml("Invalid unsubscribe link."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!verifyUnsubscribeToken(uid, token)) {
    return new NextResponse(
      renderHtml("Invalid or expired unsubscribe link."),
      {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  // Disable all email notifications for this user
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
    return new NextResponse(renderHtml("User not found."), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(
    renderHtml(
      "You have been unsubscribed from all PinPoint email notifications. " +
        'You can re-enable them anytime from your <a href="/settings">notification settings</a>.'
    ),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

function renderHtml(message: string): string {
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
  <p>${message}</p>
</body>
</html>`;
}
