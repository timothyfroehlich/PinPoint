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
const mockAdminSignOut = vi.fn();
vi.mock("~/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
        signOut: mockAdminSignOut,
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

const mockReportError = vi.fn();
vi.mock("~/lib/observability/report-error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
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
    mockAdminSignOut.mockResolvedValue({ error: null });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      role: "member",
      avatarUrl: null,
    });
    // By default, the transaction just executes the callback with a mock tx
    mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) => {
      const mockTx = {
        query: {
          userProfiles: {
            findFirst: mockFindFirst,
          },
        },
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
        query: {
          userProfiles: {
            findFirst: mockFindFirst,
          },
        },
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

  // NOTE: "deletes account and redirects on success" — RECLASS'd to
  // src/test/integration/account-deletion.test.ts (Wave 3, PP-x4li.1.3).
  // The integration test wires real PGlite and verifies DB state changes;
  // external-boundary ordering (signOut → deleteUser) tests remain below.

  it("still redirects when auth deletion fails (best-effort)", async () => {
    const { redirect } = await import("next/navigation");
    mockDeleteUser.mockResolvedValue({
      error: { message: "Auth service error" },
    });

    await expect(
      deleteAccountAction(undefined, makeFormData("DELETE"))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignOut).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("reports admin signOut errors but still proceeds with deletion", async () => {
    const signOutErr = { message: "supabase signOut failed" };
    mockAdminSignOut.mockResolvedValue({ error: signOutErr });

    await expect(
      deleteAccountAction(undefined, makeFormData("DELETE"))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockReportError).toHaveBeenCalledWith(
      signOutErr,
      expect.objectContaining({
        action: "deleteAccountAuthSignOut",
        bestEffort: true,
        userId: "user-1",
      })
    );
    // Deletion must still run even when token revocation reports an error,
    // because anonymized data has been committed and the row needs to go.
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });
});
