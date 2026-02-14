import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { notificationPreferences } from "~/server/db/schema";
import { GET, POST } from "~/app/api/unsubscribe/route";

const verifyTokenMock = vi.hoisted(() =>
  vi.fn<(uid: string, token: string) => boolean>()
);
const updateReturningMock = vi.hoisted(() =>
  vi.fn<() => Promise<{ userId: string }[]>>()
);
const updateWhereMock = vi.hoisted(() =>
  vi.fn(() => ({ returning: updateReturningMock }))
);
const updateSetMock = vi.hoisted(() =>
  vi.fn(() => ({ where: updateWhereMock }))
);
const updateMock = vi.hoisted(() => vi.fn(() => ({ set: updateSetMock })));

vi.mock("~/lib/notification-formatting", () => ({
  verifyUnsubscribeToken: verifyTokenMock,
}));

vi.mock("~/server/db", () => ({
  db: {
    update: updateMock,
  },
}));

function buildGetRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/unsubscribe${query}`, {
    method: "GET",
  });
}

function buildPostRequest(uid?: string, token?: string): NextRequest {
  const body = new URLSearchParams();
  if (uid !== undefined) body.set("uid", uid);
  if (token !== undefined) body.set("token", token);

  return new NextRequest("http://localhost/api/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

describe("/api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTokenMock.mockReturnValue(true);
    updateReturningMock.mockResolvedValue([{ userId: "user-1" }]);
  });

  it("GET returns 400 when uid or token is missing", async () => {
    const response = GET(buildGetRequest(""));
    const html = await response.text();

    expect(response.status).toBe(400);
    expect(html).toContain("Invalid unsubscribe link.");
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("GET returns 403 when token verification fails", async () => {
    verifyTokenMock.mockReturnValue(false);

    const response = GET(buildGetRequest("?uid=user-1&token=bad"));
    const html = await response.text();

    expect(response.status).toBe(403);
    expect(html).toContain("Invalid or expired unsubscribe link.");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("GET returns confirmation page and does not mutate preferences", async () => {
    const response = GET(buildGetRequest("?uid=user-1&token=valid-token"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Confirm unsubscribe");
    expect(html).toContain('<form method="post" action="/api/unsubscribe">');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("POST returns 400 when uid or token is missing", async () => {
    const response = await POST(buildPostRequest("user-1"));
    const html = await response.text();

    expect(response.status).toBe(400);
    expect(html).toContain("Invalid unsubscribe request.");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("POST returns 403 when token verification fails", async () => {
    verifyTokenMock.mockReturnValue(false);

    const response = await POST(buildPostRequest("user-1", "bad-token"));
    const html = await response.text();

    expect(response.status).toBe(403);
    expect(html).toContain("Invalid or expired unsubscribe link.");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("POST returns 404 when user preferences are missing", async () => {
    updateReturningMock.mockResolvedValue([]);

    const response = await POST(
      buildPostRequest("missing-user", "valid-token")
    );
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(html).toContain("User not found.");
    expect(updateMock).toHaveBeenCalledWith(notificationPreferences);
  });

  it("POST unsubscribes user from all email notifications", async () => {
    const response = await POST(buildPostRequest("user-1", "valid-token"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(
      "You have been unsubscribed from all PinPoint email notifications."
    );
    expect(updateMock).toHaveBeenCalledWith(notificationPreferences);
    expect(updateSetMock).toHaveBeenCalledWith({
      emailEnabled: false,
      emailNotifyOnAssigned: false,
      emailNotifyOnStatusChange: false,
      emailNotifyOnNewComment: false,
      emailNotifyOnNewIssue: false,
      emailWatchNewIssuesGlobal: false,
      emailNotifyOnMachineOwnershipChange: false,
    });
    expect(updateWhereMock).toHaveBeenCalledTimes(1);
  });
});
