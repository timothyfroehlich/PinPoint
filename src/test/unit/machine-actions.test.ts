import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMachineAction } from "~/app/(app)/m/actions";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock DB
vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    query: {
      userProfiles: {
        findFirst: vi.fn(),
      },
    },
  },
}));

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

describe("createMachineAction", () => {
  const mockUser = { id: "user-123" };
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful auth
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as SupabaseClient);
  });

  it("should successfully create a machine", async () => {
    // Mock profile found
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);

    // Mock successful insert
    const mockMachine = { id: "machine-123", initials: "MM" };
    const returningMock = vi.fn().mockResolvedValue([mockMachine]);
    const valuesMock = vi.fn(() => ({ returning: returningMock }));
    const insertMock = vi.fn(() => ({ values: valuesMock }));
    vi.mocked(db.insert).mockImplementation(insertMock as any);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");

    try {
      await createMachineAction(initialState, formData);
    } catch (e: any) {
      expect(e.message).toBe("NEXT_REDIRECT");
    }

    expect(db.insert).toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Medieval Madness",
        initials: "MM",
        ownerId: mockUser.id,
      })
    );
  });

  it("should validate input", async () => {
    // Mock profile found
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);

    const formData = new FormData();
    formData.append("name", ""); // Invalid name

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("should require authentication", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as SupabaseClient);

    const formData = new FormData();
    formData.append("name", "Test Machine");
    formData.append("initials", "TM");

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });
});
