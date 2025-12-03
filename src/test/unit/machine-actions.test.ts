import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMachineAction } from "~/app/(app)/machines/actions";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    const error = new Error("NEXT_REDIRECT");
    (error as any).digest = "NEXT_REDIRECT;replace";
    throw error;
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
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      userProfiles: {
        findFirst: vi.fn(),
      },
      machines: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

describe("createMachineAction", () => {
  const mockUser = { id: "123e4567-e89b-12d3-a456-426614174000" };
  const mockAdminUser = { id: "123e4567-e89b-12d3-a456-426614174001" };
  const otherUserId = "123e4567-e89b-12d3-a456-426614174002";
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow regular user to create machine for themselves", async () => {
    // Setup auth
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as SupabaseClient);

    // Setup profile mock (member)
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "member",
    } as any);

    // Setup insert mock
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: "machine-1", ownerId: mockUser.id }]),
      }),
    } as any);

    const formData = new FormData();
    formData.append("name", "Test Machine");

    try {
      await createMachineAction(initialState, formData);
    } catch (e: any) {
      if (e.message !== "NEXT_REDIRECT") throw e;
    }

    expect(db.insert).toHaveBeenCalled();
    // Verify ownerId is set to user.id
    const insertCall = vi.mocked(db.insert).mock.results[0].value.values.mock
      .calls[0][0];
    expect(insertCall.ownerId).toBe(mockUser.id);
  });

  it("should ignore ownerId input from regular user", async () => {
    // Setup auth
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as SupabaseClient);

    // Setup profile mock (member)
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "member",
    } as any);

    // Setup insert mock
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: "machine-1", ownerId: mockUser.id }]),
      }),
    } as any);

    const formData = new FormData();
    formData.append("name", "Test Machine");
    formData.append("ownerId", otherUserId); // Attempt to assign to another user

    let result;
    try {
      result = await createMachineAction(initialState, formData);
    } catch (e: any) {
      if (e.message !== "NEXT_REDIRECT") throw e;
    }

    if (result && !result.ok) {
      console.error("Action failed with:", result);
    }

    expect(db.insert).toHaveBeenCalled();
    // Verify ownerId is FORCED to user.id, ignoring input
    const insertCall = vi.mocked(db.insert).mock.results[0].value.values.mock
      .calls[0][0];
    expect(insertCall.ownerId).toBe(mockUser.id);
  });

  it("should allow admin to set ownerId", async () => {
    // Setup auth
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockAdminUser } }),
      },
    } as unknown as SupabaseClient);

    // Setup profile mock (admin)
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockAdminUser.id,
      role: "admin",
    } as any);

    // Setup insert mock
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: "machine-1", ownerId: otherUserId }]),
      }),
    } as any);

    const formData = new FormData();
    formData.append("name", "Test Machine");
    formData.append("ownerId", otherUserId);

    let result;
    try {
      result = await createMachineAction(initialState, formData);
    } catch (e: any) {
      if (e.message !== "NEXT_REDIRECT") throw e;
    }

    if (result && !result.ok) {
      console.error("Action failed with:", result);
    }

    expect(db.insert).toHaveBeenCalled();
    // Verify ownerId is respected
    const insertCall = vi.mocked(db.insert).mock.results[0].value.values.mock
      .calls[0][0];
    expect(insertCall.ownerId).toBe(otherUserId);
  });

  it("should fail if user profile not found", async () => {
    // Setup auth
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as SupabaseClient);

    // Setup profile mock (not found)
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("name", "Test Machine");

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });
});
