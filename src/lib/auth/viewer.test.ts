import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";

const { getUserMock, captureExceptionMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getViewer } from "~/lib/auth/viewer";

const signedOut = { userId: undefined, role: null, profile: null };

describe("getViewer auth errors", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    captureExceptionMock.mockReset();
  });

  it("reports a failed token validation and renders as signed out", async () => {
    const error = new AuthApiError("invalid JWT", 403, "bad_jwt");
    getUserMock.mockResolvedValue({ data: { user: null }, error });

    await expect(getViewer()).resolves.toEqual(signedOut);

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      contexts: {
        pinpoint: { action: "viewer.auth.getUser", bestEffort: true },
      },
    });
  });

  it("does not report the normal no-session response", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getViewer()).resolves.toEqual(signedOut);

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
