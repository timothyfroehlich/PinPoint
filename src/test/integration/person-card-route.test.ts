/**
 * Integration Test: GET /api/users/[id]/card
 *
 * Verifies the lazy card payload route returns the correct JSON for an
 * existing profile (with machine count) and 404s for an unknown id.
 * Auth is mocked to a viewer user; no email appears in the payload
 * (CORE-SEC-007).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb } from "~/test/setup/pglite";
import { signInAs } from "~/test/helpers/mock-auth";
import { seedMachine, seedUser } from "~/test/helpers/seed";

vi.mock("server-only", () => ({}));

const VIEWER = "00000000-0000-0000-0000-0000000000d0";
const TARGET = "00000000-0000-0000-0000-0000000000d1";

vi.mock("~/lib/supabase/server", () => import("~/test/helpers/mock-auth"));

const { GET } = await import("~/app/api/users/[id]/card/route");

function req(): Request {
  return new Request("http://localhost/api/users/x/card");
}

describe("GET /api/users/[id]/card", () => {
  setupTestDb();

  beforeEach(async () => {
    signInAs(VIEWER);
    await seedUser(
      {
        id: TARGET,
        email: "t@example.com",
        firstName: "Tar",
        lastName: "Get",
        role: "technician",
        pronouns: "she/they",
      },
      { authUser: false }
    );
    await seedMachine({
      initials: "CARD1",
      name: "CardMachine",
      ownerId: TARGET,
    });
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
