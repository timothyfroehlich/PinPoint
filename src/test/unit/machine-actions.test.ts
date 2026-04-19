import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMachineAction,
  updateMachineAction,
  updateMachineDescription,
  updateMachineOwnerNotes,
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

// Use vi.hoisted so these variables are available inside vi.mock() factories
const { chain, dbMock } = vi.hoisted(() => {
  const chain: any = {
    values: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
    onConflictDoUpdate: vi.fn(),
    onConflictDoNothing: vi.fn(),
  };

  chain.values.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.returning.mockResolvedValue([]);
  chain.onConflictDoUpdate.mockReturnValue(chain);
  chain.onConflictDoNothing.mockReturnValue(chain);

  const dbMock = {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    transaction: vi.fn(),
    query: {
      userProfiles: { findFirst: vi.fn() },
      machines: { findFirst: vi.fn() },
      machineWatchers: { findFirst: vi.fn() },
      invitedUsers: { findFirst: vi.fn() },
    },
  };

  // tx delegates to the same db.insert/update/delete so call counts are shared
  const txMock = {
    insert: (...args: any[]) => dbMock.insert(...args),
    update: (...args: any[]) => dbMock.update(...args),
    delete: (...args: any[]) => dbMock.delete(...args),
  };

  dbMock.transaction.mockImplementation((cb: (tx: any) => Promise<any>) =>
    cb(txMock)
  );

  return { chain, dbMock };
});

vi.mock("~/server/db", () => ({
  db: dbMock,
}));

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function resetChain() {
  chain.values.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.returning.mockResolvedValue([]);
  chain.onConflictDoUpdate.mockReturnValue(chain);
  chain.onConflictDoNothing.mockReturnValue(chain);
  // tx delegates to dbMock
  const txMock = {
    insert: (...args: any[]) => dbMock.insert(...args),
    update: (...args: any[]) => dbMock.update(...args),
    delete: (...args: any[]) => dbMock.delete(...args),
  };
  dbMock.transaction.mockImplementation((cb: (tx: any) => Promise<any>) =>
    cb(txMock)
  );
  dbMock.insert.mockReturnValue(chain);
  dbMock.update.mockReturnValue(chain);
  dbMock.delete.mockReturnValue(chain);
}

describe("createMachineAction", () => {
  const mockUser = { id: "550e8400-e29b-41d4-a716-446655440000" };
  const guestUserId = "550e8400-e29b-41d4-a716-446655440010";
  const memberUserId = "550e8400-e29b-41d4-a716-446655440011";
  const invitedGuestId = "550e8400-e29b-41d4-a716-446655440012";
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();

    // Setup default successful auth
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as SupabaseClient);
  });

  it("should successfully create a machine with no owner (ownerId is null)", async () => {
    // Mock profile found
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "admin",
    } as any);

    // Mock successful insert
    const mockMachine = {
      id: "machine-123",
      initials: "MM",
      name: "Medieval Madness",
    };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");
    // No ownerId provided

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
        ownerId: undefined,
        invitedOwnerId: undefined,
      })
    );
  });

  it("should NOT default ownerId to caller when field is empty (regression: was defaulting to caller)", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "admin",
    } as any);

    const mockMachine = { id: "machine-123", initials: "MM", name: "Test" };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("name", "Test");
    formData.append("initials", "TT");
    // Explicitly empty ownerId
    formData.append("ownerId", "");

    try {
      await createMachineAction(initialState, formData);
    } catch (e: any) {
      expect(e.message).toBe("NEXT_REDIRECT");
    }

    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: undefined })
    );
  });

  it("should reject creation for non-admin users (regression: drift fix)", async () => {
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
      message: "You must be an admin or technician to create a machine.",
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("should reject creation for guest users (regression: drift fix)", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "guest",
    } as any);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("should allow technician to create a machine", async () => {
    // Mock profile with technician role
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "technician",
    } as any);

    // Mock successful insert
    const mockMachine = { id: "machine-123", initials: "MM", name: "MM" };
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
  });

  it("should return ASSIGNEE_NOT_MEMBER when active guest is assigned as owner", async () => {
    // Admin creating machine, assigning a guest user
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        // Caller profile
        return Promise.resolve({ id: mockUser.id, role: "admin" } as any);
      }
      // Assignee lookup — guest
      return Promise.resolve({
        id: guestUserId,
        firstName: "Cory",
        lastName: "Casual",
        role: "guest",
      } as any);
    });

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");
    formData.append("ownerId", guestUserId);

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ASSIGNEE_NOT_MEMBER");
      expect(result.meta?.assignee.id).toBe(guestUserId);
      expect(result.meta?.assignee.name).toBe("Cory Casual");
      expect(result.meta?.assignee.role).toBe("guest");
      expect(result.meta?.assignee.type).toBe("active");
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("should return ASSIGNEE_NOT_MEMBER when invited guest is assigned as owner", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockUser.id, role: "admin" } as any);
      }
      // No active user found for assignee
      return Promise.resolve(undefined);
    });

    vi.mocked(db.query.invitedUsers.findFirst).mockResolvedValue({
      id: invitedGuestId,
      firstName: "Invited",
      lastName: "Guest",
      role: "guest",
    } as any);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");
    formData.append("ownerId", invitedGuestId);

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ASSIGNEE_NOT_MEMBER");
      expect(result.meta?.assignee.type).toBe("invited");
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("should atomically promote guest and create machine when forcePromoteUserId provided (admin)", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        // Caller profile
        return Promise.resolve({ id: mockUser.id, role: "admin" } as any);
      }
      // Target user — guest
      return Promise.resolve({
        id: guestUserId,
        firstName: "Cory",
        lastName: "Casual",
        role: "guest",
      } as any);
    });

    const mockMachine = { id: "machine-123", initials: "MM", name: "MM" };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");
    formData.append("ownerId", guestUserId);
    formData.append("forcePromoteUserId", guestUserId);

    try {
      await createMachineAction(initialState, formData);
    } catch (e: any) {
      expect(e.message).toBe("NEXT_REDIRECT");
    }

    // Transaction should have been called
    expect(db.transaction).toHaveBeenCalled();
    // Update should have been called (to promote user)
    expect(db.update).toHaveBeenCalled();
    // Insert should have been called (machine + watcher)
    expect(db.insert).toHaveBeenCalled();
  });

  it("should allow technician to use forcePromoteUserId", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockUser.id, role: "technician" } as any);
      }
      return Promise.resolve({
        id: guestUserId,
        firstName: "Cory",
        lastName: "Casual",
        role: "guest",
      } as any);
    });

    const mockMachine = { id: "machine-123", initials: "MM", name: "MM" };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");
    formData.append("ownerId", guestUserId);
    formData.append("forcePromoteUserId", guestUserId);

    try {
      await createMachineAction(initialState, formData);
    } catch (e: any) {
      expect(e.message).toBe("NEXT_REDIRECT");
    }

    expect(db.transaction).toHaveBeenCalled();
  });

  it("should reject forcePromoteUserId from member (UNAUTHORIZED)", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "member",
    } as any);

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");
    formData.append("ownerId", guestUserId);
    formData.append("forcePromoteUserId", guestUserId);

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("should reject forcePromoteUserId when it does not match ownerId (VALIDATION)", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "admin",
    } as any);

    const differentId = "550e8400-e29b-41d4-a716-446655440099";

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");
    formData.append("ownerId", guestUserId);
    formData.append("forcePromoteUserId", differentId);

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("should reject forcePromoteUserId pointing at non-guest user (VALIDATION)", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockUser.id, role: "admin" } as any);
      }
      // Target is a member, not a guest
      return Promise.resolve({
        id: memberUserId,
        role: "member",
      } as any);
    });

    const formData = new FormData();
    formData.append("name", "Medieval Madness");
    formData.append("initials", "MM");
    formData.append("ownerId", memberUserId);
    formData.append("forcePromoteUserId", memberUserId);

    const result = await createMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
      expect(result.message).toMatch(/not a guest/i);
    }
  });
});

describe("updateMachineAction", () => {
  const mockUser = { id: "550e8400-e29b-41d4-a716-446655440000" };
  const mockAdminUser = { id: "550e8400-e29b-41d4-a716-446655440001" };
  const machineId = "550e8400-e29b-41d4-a716-446655440002";
  const newOwnerId = "550e8400-e29b-41d4-a716-446655440003";
  const guestUserId = "550e8400-e29b-41d4-a716-446655440010";
  const memberUserId = "550e8400-e29b-41d4-a716-446655440011";
  const invitedGuestId = "550e8400-e29b-41d4-a716-446655440012";
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();

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
      initials: "TM",
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
      initials: "TM",
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

    // Mock new owner lookup
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockAdminUser.id, role: "admin" } as any);
      }
      // New owner is a member
      return Promise.resolve({ id: newOwnerId, role: "member" } as any);
    });

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

  it("should return UNAUTHORIZED when guest-owner tries to edit (regression: drift fix)", async () => {
    // Guest user who happens to be stored as owner (bad state, now prevented by DB trigger)
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "guest",
    } as any);

    // Machine has this guest as owner
    vi.mocked(db.query.machines.findFirst).mockResolvedValue({
      id: machineId,
      ownerId: mockUser.id,
      name: "Test Machine",
      initials: "TM",
    } as any);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Updated Name");

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED when non-owner member tries to update a machine", async () => {
    // Mock member profile (not admin, not owner)
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "member",
    } as any);

    // Machine owned by someone else
    vi.mocked(db.query.machines.findFirst).mockResolvedValue({
      id: machineId,
      ownerId: "550e8400-e29b-41d4-a716-446655449999",
      name: "Test Machine",
      initials: "TM",
    } as any);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Updated Name");

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("should return NOT_FOUND when machine does not exist", async () => {
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

  it("should allow member owner to transfer ownership to another member", async () => {
    // Mock member profile (owner, not admin)
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockUser.id, role: "member" } as any);
      }
      // Second call: the new owner exists as an active member
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

  it("should return ASSIGNEE_NOT_MEMBER when active guest is assigned as owner", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockUser.id, role: "admin" } as any);
      }
      // Assignee is a guest
      return Promise.resolve({
        id: guestUserId,
        firstName: "Cory",
        lastName: "Casual",
        role: "guest",
      } as any);
    });

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", guestUserId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ASSIGNEE_NOT_MEMBER");
      expect(result.meta?.assignee.id).toBe(guestUserId);
      expect(result.meta?.assignee.name).toBe("Cory Casual");
      expect(result.meta?.assignee.role).toBe("guest");
      expect(result.meta?.assignee.type).toBe("active");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("should return ASSIGNEE_NOT_MEMBER when invited guest is assigned as owner", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockUser.id, role: "admin" } as any);
      }
      // Not an active user
      return Promise.resolve(undefined);
    });

    vi.mocked(db.query.invitedUsers.findFirst).mockResolvedValue({
      id: invitedGuestId,
      firstName: "Penny",
      lastName: "Pending",
      role: "guest",
    } as any);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", invitedGuestId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ASSIGNEE_NOT_MEMBER");
      expect(result.meta?.assignee.type).toBe("invited");
      expect(result.meta?.assignee.name).toBe("Penny Pending");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("should atomically promote guest and assign machine when forcePromoteUserId provided (admin)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockAdminUser } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockAdminUser.id, role: "admin" } as any);
      }
      // Target user — guest
      return Promise.resolve({
        id: guestUserId,
        firstName: "Cory",
        lastName: "Casual",
        role: "guest",
      } as any);
    });

    const mockMachine = {
      id: machineId,
      initials: "TM",
      name: "Test Machine",
      ownerId: guestUserId,
    };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", guestUserId);
    formData.append("forcePromoteUserId", guestUserId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(true);
    // Transaction should have been called for atomic operation
    expect(db.transaction).toHaveBeenCalled();
    // Update should be called (promote + machine update)
    expect(db.update).toHaveBeenCalled();
  });

  it("should allow technician to use forcePromoteUserId (tech has the permission)", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockUser.id, role: "technician" } as any);
      }
      return Promise.resolve({
        id: guestUserId,
        firstName: "Cory",
        lastName: "Casual",
        role: "guest",
      } as any);
    });

    // Machine not owned by this technician
    vi.mocked(db.query.machines.findFirst).mockResolvedValue({
      id: machineId,
      ownerId: "550e8400-e29b-41d4-a716-446655449999",
      name: "Test Machine",
      initials: "TM",
    } as any);

    const mockMachine = {
      id: machineId,
      initials: "TM",
      name: "Test Machine",
      ownerId: guestUserId,
    };
    chain.returning.mockResolvedValue([mockMachine]);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", guestUserId);
    formData.append("forcePromoteUserId", guestUserId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(true);
    expect(db.transaction).toHaveBeenCalled();
  });

  it("should reject forcePromoteUserId from member (UNAUTHORIZED)", async () => {
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockUser.id,
      role: "member",
    } as any);

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", guestUserId);
    formData.append("forcePromoteUserId", guestUserId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("should reject forcePromoteUserId when it does not match ownerId (VALIDATION)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockAdminUser } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      id: mockAdminUser.id,
      role: "admin",
    } as any);

    const differentId = "550e8400-e29b-41d4-a716-446655440099";

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", guestUserId);
    formData.append("forcePromoteUserId", differentId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("should reject forcePromoteUserId pointing at non-guest user (VALIDATION)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockAdminUser } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockImplementation(() => {
      const calls = vi.mocked(db.query.userProfiles.findFirst).mock.calls;
      if (calls.length <= 1) {
        return Promise.resolve({ id: mockAdminUser.id, role: "admin" } as any);
      }
      // Target is a member, not a guest
      return Promise.resolve({ id: memberUserId, role: "member" } as any);
    });

    const formData = new FormData();
    formData.append("id", machineId);
    formData.append("name", "Test Machine");
    formData.append("ownerId", memberUserId);
    formData.append("forcePromoteUserId", memberUserId);

    const result = await updateMachineAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
      expect(result.message).toMatch(/not a guest/i);
    }
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

// ---------------------------------------------------------------------------
// updateMachineTextField unit tests (via exported wrapper functions)
//
// Permission matrix for reference:
//   machines.edit: unauthenticated=false, guest=false, member="owner",
//                  technician=true, admin=true
//   machines.edit.ownerNotes: all roles = "owner" (owner-only, even for admins)
//
// Behavioral-change test: technician NON-owner can now edit description
// (machines.edit: technician=true). Before the drift fix, the hardcoded
// `role === "admin"` check denied technicians. The matrix now governs this.
// ---------------------------------------------------------------------------

describe("updateMachineTextField", () => {
  const ownerUserId = "550e8400-e29b-41d4-a716-446655440000";
  const nonOwnerUserId = "550e8400-e29b-41d4-a716-446655440001";
  const machineId = "550e8400-e29b-41d4-a716-446655440002";

  // A minimal valid ProseMirror doc for test payloads
  const validDoc = {
    type: "doc" as const,
    content: [
      { type: "paragraph", content: [{ type: "text", text: "hello" }] },
    ],
  };

  // machine owned by ownerUserId
  const ownedMachine = {
    id: machineId,
    ownerId: ownerUserId,
    initials: "TM",
  };

  // machine owned by someone else (not the authenticated user)
  const unownedMachine = {
    id: machineId,
    ownerId: "550e8400-e29b-41d4-a716-446655440099",
    initials: "TM",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it("unauthenticated caller → err('UNAUTHORIZED'), no DB write", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as SupabaseClient);

    const result = await updateMachineDescription(machineId, validDoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("machine not found → err('NOT_FOUND'), no DB write", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: ownerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(undefined);

    const result = await updateMachineDescription(machineId, validDoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("invalid machineId (not a UUID) → err('VALIDATION'), no DB write", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: ownerUserId } } }),
      },
    } as unknown as SupabaseClient);

    const result = await updateMachineDescription("not-a-uuid", validDoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("guest (non-owner) attempts to edit description → err('UNAUTHORIZED'), no DB write", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: nonOwnerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "guest",
    } as any);
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(
      unownedMachine as any
    );

    const result = await updateMachineDescription(machineId, validDoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("member-owner edits description → ok, DB write called", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: ownerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(
      ownedMachine as any
    );
    // db.update chain returns undefined (no .returning() needed for setText)
    chain.where.mockResolvedValue(undefined);

    const result = await updateMachineDescription(machineId, validDoc);

    expect(result.ok).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("member-owner edits ownerNotes → ok, DB write called", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: ownerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(
      ownedMachine as any
    );
    chain.where.mockResolvedValue(undefined);

    const result = await updateMachineOwnerNotes(machineId, validDoc);

    expect(result.ok).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("member NON-owner attempts ownerNotes → err('UNAUTHORIZED') (owner-scoped permission)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: nonOwnerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    } as any);
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(
      unownedMachine as any
    );

    const result = await updateMachineOwnerNotes(machineId, validDoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("technician NON-owner edits description → ok (drift-fix behavioral test: machines.edit: technician=true)", async () => {
    // This is the key regression test. Before the drift fix, the production code had a
    // hardcoded `role === "admin"` check which denied technicians. After the fix,
    // the matrix governs: machines.edit grants technician=true unconditionally,
    // so a technician can edit description regardless of machine ownership.
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: nonOwnerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "technician",
    } as any);
    // Machine owned by someone else — technician is NOT the owner
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(
      unownedMachine as any
    );
    chain.where.mockResolvedValue(undefined);

    const result = await updateMachineDescription(machineId, validDoc);

    expect(result.ok).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("technician NON-owner attempts ownerNotes → err('UNAUTHORIZED') (machines.edit.ownerNotes: technician='owner')", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: nonOwnerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "technician",
    } as any);
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(
      unownedMachine as any
    );

    const result = await updateMachineOwnerNotes(machineId, validDoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("admin NON-owner edits description → ok (machines.edit: admin=true)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: nonOwnerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "admin",
    } as any);
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(
      unownedMachine as any
    );
    chain.where.mockResolvedValue(undefined);

    const result = await updateMachineDescription(machineId, validDoc);

    expect(result.ok).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("admin NON-owner attempts ownerNotes → err('UNAUTHORIZED') (machines.edit.ownerNotes: admin='owner')", async () => {
    // Matrix: machines.edit.ownerNotes is "owner" for ALL roles, including admin.
    // Even an admin cannot edit ownerNotes unless they are the machine owner.
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: nonOwnerUserId } } }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "admin",
    } as any);
    vi.mocked(db.query.machines.findFirst).mockResolvedValue(
      unownedMachine as any
    );

    const result = await updateMachineOwnerNotes(machineId, validDoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(db.update).not.toHaveBeenCalled();
  });
});
