import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMachineAction,
  updateMachineAction,
} from "~/app/(app)/m/actions";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT");
    (error as any).digest = `NEXT_REDIRECT;replace;${url};`;
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

// Mock notifications and logger
vi.mock("~/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Setup a shared chain for DB mocks
const chain = {
  values: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  onConflictDoNothing: vi.fn(),
} as any;

chain.values.mockReturnValue(chain);
chain.set.mockReturnValue(chain);
chain.where.mockReturnValue(chain);
chain.returning.mockResolvedValue([]);
chain.onConflictDoUpdate.mockReturnValue(chain);
chain.onConflictDoNothing.mockReturnValue(chain);

// Mock DB
vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    query: {
      userProfiles: {
        findFirst: vi.fn(),
      },
      machines: {
        findFirst: vi.fn(),
      },
      machineWatchers: {
        findFirst: vi.fn(),
      },
      invitedUsers: {
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
    chain.returning.mockResolvedValue([]);

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
      role: "admin",
    } as any);

    // Mock successful insert
    const mockMachine = { id: "machine-123", initials: "MM" };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");

    try {
      await createMachineAction(initialState, formData);
    } catch (e: any) {
      expect(e.message).toBe("NEXT_REDIRECT");
    }

    expect(db.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Medieval Madness",
        initials: "MM",
        ownerId: mockUser.id,
      })
    );
  });

  it("should reject creation for non-admin users", async () => {
    // Mock profile with member role
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");

    const result = await createMachineAction(initialState, formData);

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "You must be an admin to create a machine.",
    });
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe("updateMachineAction", () => {
  const mockUser = { id: "550e8400-e29b-41d4-a716-446655440000" };
  const mockAdminUser = { id: "550e8400-e29b-41d4-a716-446655440001" };
  const machineId = "550e8400-e29b-41d4-a716-446655440002";
  const newOwnerId = "550e8400-e29b-41d4-a716-446655440003";
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    chain.returning.mockResolvedValue([]);

    // Setup default successful auth
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as SupabaseClient);

    // Default machine found
    vi.mocked(db.query.machines.findFirst).mockResolvedValue({
      id: machineId,
      ownerId: mockUser.id,
      name: "Test Machine",
    } as any);
  });

  it("should allow admin to update unowned machine", async () => {
    // Update auth mock to use admin user
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockAdminUser } }),
      },
    } as unknown as SupabaseClient);

    // Mock machine query (for getting current owner)
    vi.mocked(db.query.machines.findFirst).mockResolvedValue({
      id: machineId,
      ownerId: mockUser.id,
      name: "Test Machine",
    } as any);

    // Mock admin profile
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockAdminUser.id,
      role: "admin",
    } as any);

    // Mock successful update
    const mockMachine = {
      id: machineId,
      initials: "MM",
      name: "Updated Name",
      ownerId: newOwnerId,
    };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Updated Name");
    formData.append("ownerId", newOwnerId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.machineId).toBe(machineId);
    }
    expect(db.update).toHaveBeenCalled();
  });

  it("should allow owner to update their own machine", async () => {
    // Mock member profile (not admin)
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "member",
    } as any);

    // Mock successful update
    const mockMachine = {
      id: machineId,
      initials: "MM",
      name: "Updated Name",
      ownerId: mockUser.id,
    };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Updated Name");

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.machineId).toBe(machineId);
    }
    expect(db.update).toHaveBeenCalled();
  });

  it("should return NOT_FOUND when non-admin tries to update another user's machine", async () => {
    // Mock member profile (not admin)
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "member",
    } as any);

    // Mock machine not found
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Updated Name");

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("should require authentication", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as SupabaseClient);

    const formData = new FormData();
    formData.append("id", "machine-123");
    formData.append("name", "Updated Name");

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("should validate input", async () => {
    // Mock profile found
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);

    const formData = new FormData();
    formData.append("id", "not-a-uuid");
    formData.append("name", "Updated Name");

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("should validate presenceStatus input", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Updated Name");
    formData.append("presenceStatus", "invalid_presence");

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("should update machine presence status", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "member",
    } as any);

    const mockMachine = {
      id: machineId,
      initials: "MM",
      name: "Updated Name",
      ownerId: mockUser.id,
      presenceStatus: "removed",
    };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Updated Name");
    formData.append("presenceStatus", "removed");

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(true);
    expect(db.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated Name",
        presenceStatus: "removed",
      })
    );
  });

  it("should allow member owner to transfer ownership", async () => {
    // Mock member profile (owner, not admin)
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      // First call: profile lookup for the authenticated user
      // Second call: checking if newOwnerId is an active user
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockUser.id, role: "member" } as any);
      }
      // Second call: the new owner exists as an active user
      return Promise.resolve({ id: newOwnerId, role: "member" } as any);
    });

    // Mock successful update
    const mockMachine = {
      id: machineId,
      initials: "TM",
      name: "Test Machine",
      ownerId: newOwnerId,
    };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", newOwnerId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.machineId).toBe(machineId);
    }
    expect(db.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: newOwnerId,
        invitedOwnerId: null,
      })
    );
  });

  it("should reject ownerId not found in user_profiles or invited_users", async () => {
    const bogusOwnerId = "550e8400-e29b-41d4-a716-446655440099";

    // Mock admin profile
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockAdminUser.id, role: "admin" } as any);
      }
      // Second call: bogus owner not found in user_profiles
      return Promise.resolve(undefined);
    });

    // Update auth to admin
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockAdminUser } }),
      },
    } as unknown as SupabaseClient);

    // Not found in invited_users either
    vi.mocked(db.query.invitedUsers.findFirst).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", bogusOwnerId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
      expect(result.message).toBe("Selected owner does not exist.");
    }
    expect(db.update).not.toHaveBeenCalled();
  });
});
