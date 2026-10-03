// @vitest-environment jsdom
/**
 * Integration Test: the machine's Apron card tab page (PP-o23o)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Covers who reaches the tab and who
 * may edit there (apron-cards spec §3.6, §3.8, §9.3), and that it is handed
 * every saved card in creation order (§1, §11.6).
 */
import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machineApronCards, machines, userProfiles } from "~/server/db/schema";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import MachineApronCardPage from "~/app/(app)/m/[initials]/(tabs)/apron/page";
import type { ApronCardTabProps } from "~/components/machines/apron/ApronCardTab";

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

class RedirectError extends Error {}
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new RedirectError(href);
  }),
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers([["host", "localhost:3000"]])),
}));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// The tab is a client component over next/font; capture its props instead.
const mockTab = vi.fn<(p: ApronCardTabProps) => React.ReactElement>(() => (
  <div data-testid="apron-card-tab" />
));
vi.mock("~/components/machines/apron/ApronCardTab", () => ({
  ApronCardTab: (p: ApronCardTabProps) => mockTab(p),
}));

const PARAMS = Promise.resolve({ initials: "GZ" });

describe("Machine Apron card tab page", () => {
  setupTestDb();

  let machineId: string;
  let ownerId: string;

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin"
  ): Promise<string> {
    const id = randomUUID();
    const db = await getTestDb();
    await db.insert(userProfiles).values(createTestUser({ id, role }));
    return id;
  }

  async function renderAs(userId: string | null): Promise<ApronCardTabProps> {
    mockGetUser.mockResolvedValue({
      data: { user: userId ? { id: userId } : null },
    });
    render(await MachineApronCardPage({ params: PARAMS }));
    const props = mockTab.mock.calls[0]?.[0];
    if (!props) throw new Error("tab not rendered");
    return props;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    ownerId = await makeUser("member");
    const db = await getTestDb();
    const [m] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "GZ", name: "Godzilla", ownerId }))
      .returning({ id: machines.id });
    if (!m) throw new Error("machine insert failed");
    machineId = m.id;
  });

  it.each([
    ["a signed-out viewer", null],
    ["a guest", "guest"],
  ] as const)("sends %s back to the machine page", async (_label, role) => {
    const userId = role ? await makeUser(role) : null;
    await expect(renderAs(userId)).rejects.toThrow(RedirectError);
    expect(mockTab).not.toHaveBeenCalled();
  });

  it("shows a member who does not own the machine Preview and Export only", async () => {
    const props = await renderAs(await makeUser("member"));
    expect(props.canEdit).toBe(false);
  });

  it("lets the owner edit", async () => {
    expect((await renderAs(ownerId)).canEdit).toBe(true);
  });

  it("lets a technician edit a machine they do not own", async () => {
    expect((await renderAs(await makeUser("technician"))).canEdit).toBe(true);
  });

  it("hands over every saved card, oldest first", async () => {
    const db = await getTestDb();
    await db.insert(machineApronCards).values([
      {
        machineId,
        name: "Tournament",
        size: "wpc",
        createdAt: new Date("2026-10-02T00:00:00Z"),
      },
      {
        machineId,
        name: "Card 1",
        size: "stern",
        createdAt: new Date("2026-10-01T00:00:00Z"),
      },
    ]);

    const props = await renderAs(ownerId);
    expect(props.savedCards.map((card) => card.name)).toEqual([
      "Card 1",
      "Tournament",
    ]);
    expect(props.scanUrl).toContain("/m/GZ/hub");
  });
});
