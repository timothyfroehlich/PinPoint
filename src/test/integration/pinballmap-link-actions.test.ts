/**
 * The Settings actions that link and unlink a member's Pinball Map account
 * (pinballmap spec 8.4, PP-o355.6): who may call them, validation, the
 * per-member rate limit, and how each link failure reaches the member.
 *
 * The role lookup runs against PGlite through the house forwarding pattern.
 * The service functions are mocked at their module boundary; their own storage
 * behavior is owned by pinballmap-user-credentials.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { authUsers, userProfiles } from "~/server/db/schema";

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  link: vi.fn(),
  unlink: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/lib/observability/report-error", () => ({
  serverActionError: (_e: unknown, code: string, message: string) => ({
    ok: false,
    code,
    message,
  }),
}));
vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: mocks.userId ? { id: mocks.userId } : null },
          }),
      },
    }),
}));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
vi.mock("~/lib/pinballmap/user-credentials", () => ({
  linkPinballMapAccount: mocks.link,
  unlinkPinballMapAccount: mocks.unlink,
}));
vi.mock("~/lib/rate-limit", () => ({ checkPinballMapLinkLimit: mocks.limit }));

const { linkPinballMapAccountAction, unlinkPinballMapAccountAction } =
  await import("~/app/(app)/settings/pinballmap/actions");

function form(login: string, password: string): FormData {
  const fd = new FormData();
  fd.set("login", login);
  fd.set("password", password);
  return fd;
}

async function signInAs(role: "guest" | "member"): Promise<string> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  await db.insert(userProfiles).values({
    id,
    email: `${id}@example.com`,
    firstName: "Test",
    lastName: "User",
    role,
  });
  mocks.userId = id;
  return id;
}

setupTestDb();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = null;
  mocks.limit.mockResolvedValue({ success: true });
});

describe("linkPinballMapAccountAction (pinballmap spec 8.4)", () => {
  it("links a member and returns the Pinball Map username", async () => {
    const userId = await signInAs("member");
    mocks.link.mockResolvedValue({ ok: true, username: "ssw" });

    const result = await linkPinballMapAccountAction(
      undefined,
      form(" ssw ", "pw")
    );

    expect(result).toEqual({ ok: true, value: { username: "ssw" } });
    expect(mocks.link).toHaveBeenCalledWith(userId, "ssw", "pw");
  });

  it("refuses a guest before calling Pinball Map", async () => {
    await signInAs("guest");

    const result = await linkPinballMapAccountAction(
      undefined,
      form("ssw", "pw")
    );

    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(mocks.link).not.toHaveBeenCalled();
  });

  it("stops at the per-member rate limit before calling Pinball Map", async () => {
    await signInAs("member");
    mocks.limit.mockResolvedValue({ success: false });

    const result = await linkPinballMapAccountAction(
      undefined,
      form("ssw", "pw")
    );

    expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(mocks.link).not.toHaveBeenCalled();
  });

  it("rejects a blank password without spending an attempt", async () => {
    await signInAs("member");
    const result = await linkPinballMapAccountAction(
      undefined,
      form("ssw", "")
    );

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it("passes Pinball Map's own sign-in message through", async () => {
    await signInAs("member");
    mocks.link.mockResolvedValue({
      ok: false,
      reason: "invalid_credentials",
      message:
        "User is not yet confirmed. Please follow emailed confirmation instructions.",
    });

    const result = await linkPinballMapAccountAction(
      undefined,
      form("ssw", "pw")
    );

    expect(result).toEqual({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message:
        "User is not yet confirmed. Please follow emailed confirmation instructions.",
    });
  });

  it("maps a disabled account to its own code", async () => {
    await signInAs("member");
    mocks.link.mockResolvedValue({ ok: false, reason: "account_disabled" });

    const result = await linkPinballMapAccountAction(
      undefined,
      form("ssw", "pw")
    );

    expect(result).toMatchObject({ ok: false, code: "ACCOUNT_DISABLED" });
  });
});

describe("unlinkPinballMapAccountAction", () => {
  it("unlinks the signed-in member", async () => {
    const userId = await signInAs("member");

    const result = await unlinkPinballMapAccountAction();

    expect(result).toEqual({ ok: true, value: {} });
    expect(mocks.unlink).toHaveBeenCalledWith(userId);
  });

  it("lets someone without the link permission delete their stored token", async () => {
    const userId = await signInAs("guest");

    const result = await unlinkPinballMapAccountAction();

    expect(result).toEqual({ ok: true, value: {} });
    expect(mocks.unlink).toHaveBeenCalledWith(userId);
  });

  it("refuses when signed out", async () => {
    const result = await unlinkPinballMapAccountAction();

    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(mocks.unlink).not.toHaveBeenCalled();
  });
});
