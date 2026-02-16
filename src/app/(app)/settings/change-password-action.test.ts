import { describe, it, expect, vi, beforeEach } from "vitest";
import { changePasswordAction } from "./actions";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        signInWithPassword: mockSignInWithPassword,
        updateUser: mockUpdateUser,
      },
    })
  ),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- Helpers ---

function makeFormData(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): FormData {
  const fd = new FormData();
  fd.set("currentPassword", currentPassword);
  fd.set("newPassword", newPassword);
  fd.set("confirmNewPassword", confirmNewPassword);
  return fd;
}

// --- Tests ---

describe("changePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("returns UNAUTHORIZED when not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await changePasswordAction(
      undefined,
      makeFormData("oldPass1!", "newPass12", "newPass12")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("returns VALIDATION when new password is too short", async () => {
    const result = await changePasswordAction(
      undefined,
      makeFormData("oldPass1!", "short", "short")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("returns VALIDATION when passwords do not match", async () => {
    const result = await changePasswordAction(
      undefined,
      makeFormData("oldPass1!", "newPass12", "different1")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("returns WRONG_PASSWORD when current password is incorrect", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const result = await changePasswordAction(
      undefined,
      makeFormData("wrongPass", "newPass12", "newPass12")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WRONG_PASSWORD");
    }
  });

  it("returns SERVER when updateUser fails", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: "Password update failed" },
    });

    const result = await changePasswordAction(
      undefined,
      makeFormData("oldPass1!", "newPass12", "newPass12")
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
    }
  });

  it("returns success when password is changed", async () => {
    const result = await changePasswordAction(
      undefined,
      makeFormData("oldPass1!", "newPass12", "newPass12")
    );

    expect(result.ok).toBe(true);

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "oldPass1!",
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: "newPass12",
    });
  });
});
