import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteAccountAction } from "./actions";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        signOut: mockSignOut,
      },
    })
  ),
}));

const mockDeleteUser = vi.fn();
vi.mock("~/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
  })),
}));

const mockTransaction = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    query: {
      userProfiles: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("~/lib/blob/client", () => ({
  deleteFromBlob: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new RedirectError();
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

class RedirectError extends Error {
  constructor() {
    super("NEXT_REDIRECT");
    this.name = "RedirectError";
  }
}

// --- Helpers ---

function makeFormData(confirmation: string, reassignTo = ""): FormData {
  const fd = new FormData();
  fd.set("confirmation", confirmation);
  fd.set("reassignTo", reassignTo);
  return fd;
}

// --- Tests ---

describe("deleteAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      role: "member",
      avatarUrl: null,
    });
    // By default, the transaction just executes the callback with a mock tx
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) => {
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ count: 2 }])),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve()),
          })),
        })),
      };
      return cb(mockTx);
    });
  });

  it("returns UNAUTHORIZED when not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await deleteAccountAction(undefined, makeFormData("DELETE"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("returns VALIDATION when confirmation is wrong", async () => {
    const result = await deleteAccountAction(undefined, makeFormData("WRONG"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("returns SOLE_ADMIN when user is last admin", async () => {
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      role: "admin",
      avatarUrl: null,
    });
    // Override transaction to simulate the sole admin check
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) => {
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ count: 0 }])),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve()),
          })),
        })),
      };
      return cb(mockTx);
    });

    const result = await deleteAccountAction(undefined, makeFormData("DELETE"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SOLE_ADMIN");
    }
  });

  it("deletes account and redirects on success", async () => {
    const { redirect } = await import("next/navigation");

    await expect(
      deleteAccountAction(undefined, makeFormData("DELETE"))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
    expect(mockSignOut).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("returns SERVER error when auth deletion fails", async () => {
    mockDeleteUser.mockResolvedValue({
      error: { message: "Auth service error" },
    });

    const result = await deleteAccountAction(undefined, makeFormData("DELETE"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
    }
  });
});
