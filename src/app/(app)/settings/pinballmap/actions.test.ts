import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findProfile: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
  limit: vi.fn(),
}));

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
  createClient: () => Promise.resolve({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("~/server/db", () => ({
  db: { query: { userProfiles: { findFirst: mocks.findProfile } } },
}));
vi.mock("~/lib/pinballmap/user-credentials", () => ({
  linkPinballMapAccount: mocks.link,
  unlinkPinballMapAccount: mocks.unlink,
}));
vi.mock("~/lib/rate-limit", () => ({ checkPinballMapLinkLimit: mocks.limit }));

const { linkPinballMapAccountAction, unlinkPinballMapAccountAction } =
  await import("./actions");

function form(login: string, password: string): FormData {
  const fd = new FormData();
  fd.set("login", login);
  fd.set("password", password);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.findProfile.mockResolvedValue({ role: "member" });
  mocks.limit.mockResolvedValue({ success: true });
});

describe("linkPinballMapAccountAction (pinballmap spec 8.4)", () => {
  it("links a member and returns the Pinball Map username", async () => {
    mocks.link.mockResolvedValue({ ok: true, username: "ssw" });

    const result = await linkPinballMapAccountAction(
      undefined,
      form(" ssw ", "pw")
    );

    expect(result).toEqual({ ok: true, value: { username: "ssw" } });
    expect(mocks.link).toHaveBeenCalledWith("user-1", "ssw", "pw");
  });

  it("refuses a guest before calling Pinball Map", async () => {
    mocks.findProfile.mockResolvedValue({ role: "guest" });

    const result = await linkPinballMapAccountAction(
      undefined,
      form("ssw", "pw")
    );

    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(mocks.link).not.toHaveBeenCalled();
  });

  it("stops at the per-member rate limit before calling Pinball Map", async () => {
    mocks.limit.mockResolvedValue({ success: false });

    const result = await linkPinballMapAccountAction(
      undefined,
      form("ssw", "pw")
    );

    expect(result).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(mocks.link).not.toHaveBeenCalled();
  });

  it("rejects a blank password without spending an attempt", async () => {
    const result = await linkPinballMapAccountAction(
      undefined,
      form("ssw", "")
    );

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it("passes Pinball Map's own sign-in message through", async () => {
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
    const result = await unlinkPinballMapAccountAction();

    expect(result).toEqual({ ok: true, value: {} });
    expect(mocks.unlink).toHaveBeenCalledWith("user-1");
  });

  it("lets someone without the link permission delete their stored token", async () => {
    mocks.findProfile.mockResolvedValue({ role: "guest" });

    const result = await unlinkPinballMapAccountAction();

    expect(result).toEqual({ ok: true, value: {} });
    expect(mocks.unlink).toHaveBeenCalledWith("user-1");
  });

  it("refuses when signed out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const result = await unlinkPinballMapAccountAction();

    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(mocks.unlink).not.toHaveBeenCalled();
  });
});
