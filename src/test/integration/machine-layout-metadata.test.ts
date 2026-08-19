import { describe, it, expect, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, pinballmapCatalog } from "~/server/db/schema";
import { createTestMachine } from "~/test/helpers/factories";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

const { getMachineForLayout } = await import("~/app/(app)/m/[initials]/_data");

/**
 * `getMachineForLayout` is what every `/m/[initials]/*` surface reads, and for
 * most of a year it spread a hardcoded `{manufacturer: null, year: null, …}`
 * over the row it had just fetched (PP-3bbr.1). The placeholder predated those
 * columns existing; once they were real it silently overwrote them, so the
 * machine header rendered an empty sub-line on every machine that had the data
 * and nobody could tell the difference from a machine that genuinely had none.
 *
 * These tests exist because that failure is invisible by construction: the
 * query is right, the columns are populated, and a `null` reaching the
 * component looks exactly like an absent value. Asserting the loader's OUTPUT
 * rather than the query is the only place the difference shows.
 */
describe("getMachineForLayout — model metadata", () => {
  // Registers the beforeAll/afterEach pair itself — call it at describe scope,
  // not from inside a hook.
  setupTestDb();

  it("returns the stored manufacturer and year rather than nulls", async () => {
    const db = await getTestDb();
    await db.insert(pinballmapCatalog).values({
      pinballmapMachineId: 3416,
      name: "Godzilla (Premium)",
      manufacturer: "Stern",
      year: 2021,
    });
    await db.insert(machines).values(
      createTestMachine({
        initials: "GDZ",
        name: "Godzilla",
        pinballmapMachineId: 3416,
        manufacturer: "Stern",
        year: 2021,
      })
    );

    const { machine } = await getMachineForLayout("GDZ");

    expect(machine?.manufacturer).toBe("Stern");
    expect(machine?.year).toBe(2021);
  });

  it("resolves the model title from the catalog for a matched machine", async () => {
    const db = await getTestDb();
    await db.insert(pinballmapCatalog).values({
      pinballmapMachineId: 2565,
      name: "Spider-Man (Vault Edition)",
      manufacturer: "Stern",
      year: 2016,
    });
    await db.insert(machines).values(
      createTestMachine({
        initials: "SM",
        name: "Spider-Man",
        pinballmapMachineId: 2565,
      })
    );

    const { machine } = await getMachineForLayout("SM");

    expect(machine?.modelTitle).toBe("Spider-Man (Vault Edition)");
  });

  it("resolves the model title from the hand-entered name when uncataloged", async () => {
    const db = await getTestDb();
    await db.insert(machines).values(
      createTestMachine({
        initials: "HB",
        name: "Hyperball",
        pinballmapExcluded: true,
        modelName: "Hyperball",
        manufacturer: "Williams",
        year: 1981,
      })
    );

    const { machine } = await getMachineForLayout("HB");

    // The whole point of PP-3bbr: a game their catalog cannot carry still has a
    // model identity, and it reaches the header by the same field a matched
    // machine's catalog title does.
    expect(machine?.modelTitle).toBe("Hyperball");
    expect(machine?.manufacturer).toBe("Williams");
    expect(machine?.year).toBe(1981);
  });

  it("has no model title for a machine nobody has matched or declared", async () => {
    const db = await getTestDb();
    await db
      .insert(machines)
      .values(createTestMachine({ initials: "AFM", name: "Attack from Mars" }));

    const { machine } = await getMachineForLayout("AFM");

    expect(machine?.modelTitle).toBeNull();
    expect(machine?.manufacturer).toBeNull();
  });

  it("names the id when a matched machine's catalog row has gone", async () => {
    const db = await getTestDb();
    // Linked, but the mirror has no such row — a title retired upstream, or a
    // catalog never refreshed. Reporting "no model" here would misstate a real
    // recorded decision as an absent one (CORE-ARCH-012).
    await db.insert(machines).values(
      createTestMachine({
        initials: "XX",
        name: "Orphan",
        pinballmapMachineId: 99999,
      })
    );

    const { machine } = await getMachineForLayout("XX");

    expect(machine?.modelTitle).toBe("Pinball Map title #99999");
  });

  it("still reports no backbox art, which has no source anywhere", async () => {
    const db = await getTestDb();
    await db
      .insert(machines)
      .values(createTestMachine({ initials: "BK", name: "Black Knight" }));

    const { machine } = await getMachineForLayout("BK");

    // The one surviving placeholder field. When PP-o355.43 gives it a source —
    // or deletes the translite outright — this assertion is the thing that
    // should fail and be rewritten, rather than the change landing unnoticed.
    expect(machine?.backboxImageUrl).toBeNull();
  });
});
