// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, userProfiles } from "~/server/db/schema";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import MachineInfoTab from "~/app/(app)/m/[initials]/(tabs)/page";

// Mock Supabase Server Client
const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    }),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers([["host", "localhost:3000"]])),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock the global db to point to our test db from PGlite
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

// Mock MachineTextFields to capture props passed down
const mockMachineTextFields = vi.fn(() => (
  <div data-testid="machine-text-fields" />
));
vi.mock("~/app/(app)/m/[initials]/machine-text-fields", () => ({
  MachineTextFields: (props: {
    machineId: string;
    description: string | null;
    tournamentNotes: string | null;
    ownerRequirements: string | null;
    ownerNotes: string | null;
    canEditGeneral: boolean;
    canEditOwnerNotes: boolean;
    canViewOwnerRequirements: boolean;
    canViewOwnerNotes: boolean;
  }) => {
    mockMachineTextFields(props);
    return <div data-testid="machine-text-fields" />;
  },
}));

describe("MachineInfoTab Page-Level Auth Integration", () => {
  setupTestDb();

  let testMachine: { id: string; initials: string; ownerId: string | null };

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await getTestDb();

    // Create a test machine owned by a specific ID (or null)
    const [machine] = await db
      .insert(machines)
      .values(
        createTestMachine({
          initials: "TAF",
          name: "The Addams Family",
          ownerId: null,
        })
      )
      .returning();
    testMachine = machine;
  });

  it("denies ownerRequirements view and ownerNotes view/edit to unauthenticated visitors", async () => {
    // Mock no user logged in
    mockGetUser.mockResolvedValue({ data: { user: null } });

    // Call the server component
    const result = await MachineInfoTab({
      params: Promise.resolve({ initials: testMachine.initials }),
    });

    render(result);

    expect(mockMachineTextFields).toHaveBeenCalled();
    const props = mockMachineTextFields.mock.calls[0][0];

    // Assert computed permissions passed to the child component
    expect(props.canViewOwnerRequirements).toBe(false);
    expect(props.canViewOwnerNotes).toBe(false);
    expect(props.canEditGeneral).toBe(false);
    expect(props.canEditOwnerNotes).toBe(false);
  });

  it("allows ownerRequirements view to guest, but denies ownerNotes view/edit", async () => {
    const db = await getTestDb();

    const guestId = randomUUID();
    const guestEmail = "guest@test.com";

    // Insert user profile
    await db.insert(userProfiles).values(
      createTestUser({
        id: guestId,
        email: guestEmail,
        role: "guest",
      })
    );

    mockGetUser.mockResolvedValue({
      data: { user: { id: guestId, email: guestEmail } },
    });

    const result = await MachineInfoTab({
      params: Promise.resolve({ initials: testMachine.initials }),
    });

    render(result);

    expect(mockMachineTextFields).toHaveBeenCalled();
    const props = mockMachineTextFields.mock.calls[0][0];

    // Guests can view requirements, but not view/edit owner notes
    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canViewOwnerNotes).toBe(false);
    expect(props.canEditGeneral).toBe(false);
    expect(props.canEditOwnerNotes).toBe(false);
  });

  it("allows ownerRequirements view to non-owner member, but denies ownerNotes view/edit", async () => {
    const db = await getTestDb();

    const memberId = randomUUID();
    const memberEmail = "member@test.com";

    // Insert user profile
    await db.insert(userProfiles).values(
      createTestUser({
        id: memberId,
        email: memberEmail,
        role: "member",
      })
    );

    mockGetUser.mockResolvedValue({
      data: { user: { id: memberId, email: memberEmail } },
    });

    const result = await MachineInfoTab({
      params: Promise.resolve({ initials: testMachine.initials }),
    });

    render(result);

    expect(mockMachineTextFields).toHaveBeenCalled();
    const props = mockMachineTextFields.mock.calls[0][0];

    // Non-owner member can view requirements, but not view/edit owner notes
    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canViewOwnerNotes).toBe(false);
    expect(props.canEditGeneral).toBe(false);
    expect(props.canEditOwnerNotes).toBe(false);
  });

  it("allows ownerRequirements view AND ownerNotes view/edit to machine owner member", async () => {
    const db = await getTestDb();

    const ownerId = randomUUID();
    const ownerEmail = "owner@test.com";

    // Insert owner profile
    await db.insert(userProfiles).values(
      createTestUser({
        id: ownerId,
        email: ownerEmail,
        role: "member",
      })
    );

    // Update machine owner
    await db
      .update(machines)
      .set({ ownerId })
      .where(eq(machines.id, testMachine.id));

    mockGetUser.mockResolvedValue({
      data: { user: { id: ownerId, email: ownerEmail } },
    });

    const result = await MachineInfoTab({
      params: Promise.resolve({ initials: testMachine.initials }),
    });

    render(result);

    expect(mockMachineTextFields).toHaveBeenCalled();
    const props = mockMachineTextFields.mock.calls[0][0];

    // Owner member has full view & edit of owner requirements and notes
    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canViewOwnerNotes).toBe(true);
    expect(props.canEditGeneral).toBe(true);
    expect(props.canEditOwnerNotes).toBe(true);
  });

  it("allows ownerRequirements view to admin, but denies ownerNotes view/edit if not the machine owner", async () => {
    const db = await getTestDb();

    const adminId = randomUUID();
    const adminEmail = "admin@test.com";

    // Insert admin profile
    await db.insert(userProfiles).values(
      createTestUser({
        id: adminId,
        email: adminEmail,
        role: "admin",
      })
    );

    // Set owner to someone else
    const someoneElseId = randomUUID();
    const someoneElseEmail = "someoneelse@test.com";
    await db.insert(userProfiles).values(
      createTestUser({
        id: someoneElseId,
        email: someoneElseEmail,
        role: "member",
      })
    );

    await db
      .update(machines)
      .set({ ownerId: someoneElseId })
      .where(eq(machines.id, testMachine.id));

    mockGetUser.mockResolvedValue({
      data: { user: { id: adminId, email: adminEmail } },
    });

    const result = await MachineInfoTab({
      params: Promise.resolve({ initials: testMachine.initials }),
    });

    render(result);

    expect(mockMachineTextFields).toHaveBeenCalled();
    const props = mockMachineTextFields.mock.calls[0][0];

    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canViewOwnerNotes).toBe(false);
    expect(props.canEditGeneral).toBe(true);
    expect(props.canEditOwnerNotes).toBe(false);
  });
});
