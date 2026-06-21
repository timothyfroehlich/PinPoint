/**
 * Integration Test: GET /api/users/[id]/card
 *
 * Verifies the lazy card payload route returns the correct JSON for an
 * existing profile (with machine count) and 404s for an unknown id.
 * Auth is mocked to a viewer user; no email appears in the payload
 * (CORE-SEC-007).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles, machines } from "~/server/db/schema";

vi.mock("server-only", () => ({}));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const VIEWER = "00000000-0000-0000-0000-0000000000d0";
const TARGET = "00000000-0000-0000-0000-0000000000d1";

vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: VIEWER } }, error: null }),
      },
    }),
}));

const { GET } = await import("~/app/api/users/[id]/card/route");

function req(): Request {
  return new Request("http://localhost/api/users/x/card");
}

describe("GET /api/users/[id]/card", () => {
  setupTestDb();

  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(userProfiles).values({
      id: TARGET,
      email: "t@example.com",
      firstName: "Tar",
      lastName: "Get",
      role: "technician",
      pronouns: "she/they",
    });
    await db
      .insert(machines)
      .values({ initials: "CARD1", name: "CardMachine", ownerId: TARGET });
  });

  it("returns the card payload for an existing profile", async () => {
    const res = await GET(req(), { params: Promise.resolve({ id: TARGET }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      name: "Tar Get",
      role: "technician",
      pronouns: "she/they",
      machineCount: 1,
    });
    // CORE-SEC-007: email must NOT appear in the payload
    expect(body).not.toHaveProperty("email");
  });

  it("404s for an unknown id", async () => {
    const res = await GET(req(), { params: Promise.resolve({ id: VIEWER }) });
    expect(res.status).toBe(404);
  });
});
