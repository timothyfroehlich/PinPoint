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

// Mock the text-field components to capture the permission props the page
// computes. `MachineTextFields` (owner requirements) only renders when the
// viewer is allowed to see an owner-private field; the description renders
// separately via `MachineDescriptionField`.
interface MachineTextFieldsProps {
  machineId: string;
  description: string | null;
  ownerRequirements: string | null;
  canEditGeneral: boolean;
  canViewOwnerRequirements: boolean;
  showDescription?: boolean;
}
const mockMachineTextFields = vi.fn<
  (props: MachineTextFieldsProps) => React.ReactElement
>(() => <div data-testid="machine-text-fields" />);
const mockMachineDescriptionField = vi.fn(() => (
  <div data-testid="machine-description" />
));
// MachineRecentActivity is an async server component; left unmocked it
// suspends during the RTL render and prevents later siblings (the maintainer
// tools block, which holds MachineTextFields) from rendering. This test only
// cares about the permission props, so stub it out.
vi.mock("~/components/machines/timeline/MachineRecentActivity", () => ({
  MachineRecentActivity: () => <div data-testid="machine-recent-activity" />,
}));

vi.mock("~/app/(app)/m/[initials]/machine-text-fields", () => ({
  MachineTextFields: (props: MachineTextFieldsProps) => {
    mockMachineTextFields(props);
    return <div data-testid="machine-text-fields" />;
  },
  MachineDescriptionField: (props: {
    machineId: string;
    description: string | null;
    canEdit: boolean;
  }) => {
    mockMachineDescriptionField(props);
    return <div data-testid="machine-description" />;
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

  it("hides all owner-private fields from unauthenticated visitors", async () => {
    // Mock no user logged in
    mockGetUser.mockResolvedValue({ data: { user: null } });

    // Call the server component
    const result = await MachineInfoTab({
      params: Promise.resolve({ initials: testMachine.initials }),
    });

    render(result);

    // Anonymous viewers can see neither requirements nor notes, so the
    // owner-fields block is not rendered at all (privacy by omission).
    expect(mockMachineTextFields).not.toHaveBeenCalled();

    // The description still renders, read-only (cannot edit).
    expect(mockMachineDescriptionField).toHaveBeenCalled();
    const descProps = mockMachineDescriptionField.mock.calls[0][0];
    expect(descProps.canEdit).toBe(false);
  });

  it("allows ownerRequirements view to guest", async () => {
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

    // Guests can view requirements
    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canEditGeneral).toBe(false);
  });

  it("allows ownerRequirements view to non-owner member", async () => {
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

    // Non-owner member can view requirements
    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canEditGeneral).toBe(false);
  });

  it("allows ownerRequirements view to machine owner member", async () => {
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

    // Owner member has full view & edit of owner requirements
    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canEditGeneral).toBe(true);
  });

  it("allows ownerRequirements view to admin", async () => {
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
    expect(props.canEditGeneral).toBe(true);
  });
});
