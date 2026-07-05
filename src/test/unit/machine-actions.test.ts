import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateMachineAction,
  updateMachineDescription,
  updateMachineOwnerRequirements,
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
  getChannels: vi.fn().mockResolvedValue([]),
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
  // Default returns a row with an id: inserts always return their row, and
  // `createMachineTimelineEvent` reads `.returning({ id })` (PP-tv9l) for its
  // timeline_event_people rows. Tests that need a specific row override this.
  chain.returning.mockResolvedValue([
    { id: "00000000-0000-4000-8000-00000000ev01" },
  ]);
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

  // tx delegates to the same db.insert/update/delete/query so call counts are shared
  const txMock = {
    insert: (...args: any[]) => dbMock.insert(...args),
    update: (...args: any[]) => dbMock.update(...args),
    delete: (...args: any[]) => dbMock.delete(...args),
    query: dbMock.query,
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
  // Default returns a row with an id: inserts always return their row, and
  // `createMachineTimelineEvent` reads `.returning({ id })` (PP-tv9l) for its
  // timeline_event_people rows. Tests that need a specific row override this.
  chain.returning.mockResolvedValue([
    { id: "00000000-0000-4000-8000-00000000ev01" },
  ]);
  chain.onConflictDoUpdate.mockReturnValue(chain);
  chain.onConflictDoNothing.mockReturnValue(chain);
  // tx delegates to dbMock
  const txMock = {
    insert: (...args: any[]) => dbMock.insert(...args),
    update: (...args: any[]) => dbMock.update(...args),
    delete: (...args: any[]) => dbMock.delete(...args),
    query: dbMock.query,
  };
  dbMock.transaction.mockImplementation((cb: (tx: any) => Promise<any>) =>
    cb(txMock)
  );
  dbMock.insert.mockReturnValue(chain);
  dbMock.update.mockReturnValue(chain);
  dbMock.delete.mockReturnValue(chain);
}

describe("updateMachineAction", () => {
  // Kept: pre-DB gate tests that don't require a real database (KEEP-unit per routing table).
  // Blocks 1–5, 9–10, 14–18 have been RECLASS'd to machine-owner-promotion.test.ts.
  // Blocks 11–13 have been DELETE-redundant (already covered in machine-owner-promotion.test.ts).

  const mockUser = { id: "550e8400-e29b-41d4-a716-446655440000" };
  const machineId = "550e8400-e29b-41d4-a716-446655440002";
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
});

// ---------------------------------------------------------------------------
// updateMachineTextField unit tests (KEEP-unit blocks only)
//
// Permission matrix for reference:
//   machines.edit: unauthenticated=false, guest=false, member="owner",
//                  technician=true, admin=true
//
// Blocks 4–11 and 13–14 have been RECLASS'd to machine-owner-promotion.test.ts
// (Wave 3 RECLASS, PP-x4li.1.3). Only pre-permission gate tests remain here:
//   Block 1: unauthenticated auth gate (KEEP-unit)
//   Block 2: machine not found existence gate (KEEP-unit)
//   Block 3: invalid machineId Zod validation (KEEP-unit)
//   Block 12: unauthenticated ownerRequirements auth gate (KEEP-unit)
// ---------------------------------------------------------------------------

describe("updateMachineTextField", () => {
  const ownerUserId = "550e8400-e29b-41d4-a716-446655440000";
  const machineId = "550e8400-e29b-41d4-a716-446655440002";

  // A minimal valid ProseMirror doc for test payloads
  const validDoc = {
    type: "doc" as const,
    content: [
      { type: "paragraph", content: [{ type: "text", text: "hello" }] },
    ],
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

  // ---------------------------------------------------------------------------
  // ownerRequirements auth gate (KEEP-unit — pre-permission, block 12)
  // ---------------------------------------------------------------------------

  it("unauthenticated caller → ownerRequirements err('UNAUTHORIZED'), no DB write", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as SupabaseClient);

    const result = await updateMachineOwnerRequirements(machineId, validDoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(db.update).not.toHaveBeenCalled();
  });
});
