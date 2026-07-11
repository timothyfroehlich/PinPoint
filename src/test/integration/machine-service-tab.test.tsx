// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, issues, userProfiles } from "~/server/db/schema";
import {
  createTestMachine,
  createTestUser,
  createTestIssue,
} from "~/test/helpers/factories";
import MachineMaintenanceTab from "~/app/(app)/m/[initials]/(tabs)/maintenance/page";

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers([["host", "localhost:3000"]])),
}));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

// MachineRecentActivity is an async server component (queries the timeline);
// left unmocked it suspends in RTL. Stub it to capture the props the page
// passes — the feed's own row rendering is covered by its component/E2E tests.
interface RecentActivityProps {
  machineId: string;
  machineInitials: string;
  machineName: string;
  canCompose: boolean;
}
const mockRecentActivity = vi.fn<
  (p: RecentActivityProps) => React.ReactElement
>(() => <div data-testid="machine-recent-activity" />);
vi.mock("~/components/machines/timeline/MachineRecentActivity", () => ({
  MachineRecentActivity: (p: RecentActivityProps) => mockRecentActivity(p),
}));

// The issues card + watch button are client leaves not under test here; stub
// them so the page renders without a TooltipProvider / server-action imports.
interface IssuesCardProps {
  issues: { id: string }[];
  view: "open" | "all";
  machineInitials: string;
}
const mockIssuesCard = vi.fn<(p: IssuesCardProps) => React.ReactElement>(() => (
  <div data-testid="issues-section" />
));
vi.mock("~/app/(app)/m/[initials]/machine-issues-card", () => ({
  MachineIssuesCard: (p: IssuesCardProps) => mockIssuesCard(p),
}));
vi.mock("~/components/machines/WatchMachineButton", () => ({
  WatchMachineButton: () => <div data-testid="watch-button" />,
}));

// Owner's Requirements + presence live in the ops box (relocated off the Info
// tab, PP-5sgt.3). Stub it to capture the permission props the page computes —
// this is where the Info tab's owner-private gating coverage now lives.
interface OpsBoxProps {
  canEditPresence: boolean;
  canViewOwnerRequirements: boolean;
  canEditGeneral: boolean;
}
const mockOpsBox = vi.fn<(p: OpsBoxProps) => React.ReactElement>(() => (
  <div data-testid="machine-ops-box" />
));
vi.mock("~/app/(app)/m/[initials]/machine-ops-box", () => ({
  MachineOpsBox: (p: OpsBoxProps) => mockOpsBox(p),
}));

const NO_PARAMS = Promise.resolve<Record<string, string | undefined>>({});

describe("Machine Service (maintenance) tab", () => {
  setupTestDb();

  let machine: { id: string; initials: string };

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await getTestDb();
    const [m] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "GZ", name: "Godzilla" }))
      .returning();
    machine = m;
    // One open + one closed issue so Open vs All views differ.
    await db
      .insert(issues)
      .values([
        createTestIssue("GZ", { issueNumber: 1, status: "new" }),
        createTestIssue("GZ", { issueNumber: 2, status: "fixed" }),
      ]);
  });

  it("mounts the Activity feed with the machine id and a compose gate", async () => {
    const memberId = randomUUID();
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: memberId, role: "member" }));
    mockGetUser.mockResolvedValue({ data: { user: { id: memberId } } });

    render(
      await MachineMaintenanceTab({
        params: Promise.resolve({ initials: "GZ" }),
        searchParams: NO_PARAMS,
      })
    );

    expect(mockRecentActivity).toHaveBeenCalledOnce();
    const props = mockRecentActivity.mock.calls[0][0];
    expect(props.machineId).toBe(machine.id);
    expect(props.machineInitials).toBe("GZ");
    // members may post notes
    expect(props.canCompose).toBe(true);
  });

  it("denies the compose gate to anonymous viewers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(
      await MachineMaintenanceTab({
        params: Promise.resolve({ initials: "GZ" }),
        searchParams: NO_PARAMS,
      })
    );

    expect(mockRecentActivity.mock.calls[0][0].canCompose).toBe(false);
  });

  it("shows only open issues by default", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(
      await MachineMaintenanceTab({
        params: Promise.resolve({ initials: "GZ" }),
        searchParams: NO_PARAMS,
      })
    );

    const props = mockIssuesCard.mock.calls[0][0];
    expect(props.view).toBe("open");
    expect(props.issues).toHaveLength(1);
  });

  it("shows all issues when ?view=all", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(
      await MachineMaintenanceTab({
        params: Promise.resolve({ initials: "GZ" }),
        searchParams: Promise.resolve({ view: "all" }),
      })
    );

    const props = mockIssuesCard.mock.calls[0][0];
    expect(props.view).toBe("all");
    expect(props.issues).toHaveLength(2);
  });

  // Owner-private field gating (relocated here from the Info tab).
  it("hides Owner's Requirements from anonymous viewers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    render(
      await MachineMaintenanceTab({
        params: Promise.resolve({ initials: "GZ" }),
        searchParams: NO_PARAMS,
      })
    );
    const props = mockOpsBox.mock.calls[0][0];
    expect(props.canViewOwnerRequirements).toBe(false);
    expect(props.canEditGeneral).toBe(false);
  });

  it("lets a guest VIEW but not edit Owner's Requirements", async () => {
    const guestId = randomUUID();
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: guestId, role: "guest" }));
    mockGetUser.mockResolvedValue({ data: { user: { id: guestId } } });

    render(
      await MachineMaintenanceTab({
        params: Promise.resolve({ initials: "GZ" }),
        searchParams: NO_PARAMS,
      })
    );
    const props = mockOpsBox.mock.calls[0][0];
    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canEditGeneral).toBe(false);
  });

  it("grants the machine owner edit of Owner's Requirements + presence", async () => {
    const ownerId = randomUUID();
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: ownerId, role: "member" }));
    await db
      .update(machines)
      .set({ ownerId })
      .where(eq(machines.id, machine.id));
    mockGetUser.mockResolvedValue({ data: { user: { id: ownerId } } });

    render(
      await MachineMaintenanceTab({
        params: Promise.resolve({ initials: "GZ" }),
        searchParams: NO_PARAMS,
      })
    );
    const props = mockOpsBox.mock.calls[0][0];
    expect(props.canEditGeneral).toBe(true);
    expect(props.canEditPresence).toBe(true);
  });

  it("grants an admin edit of Owner's Requirements", async () => {
    const adminId = randomUUID();
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: adminId, role: "admin" }));
    mockGetUser.mockResolvedValue({ data: { user: { id: adminId } } });

    render(
      await MachineMaintenanceTab({
        params: Promise.resolve({ initials: "GZ" }),
        searchParams: NO_PARAMS,
      })
    );
    const props = mockOpsBox.mock.calls[0][0];
    expect(props.canViewOwnerRequirements).toBe(true);
    expect(props.canEditGeneral).toBe(true);
  });
});
