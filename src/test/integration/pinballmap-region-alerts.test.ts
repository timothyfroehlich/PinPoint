/**
 * Integration Test: PinballMap region new-machine alerts (PP-o355.18)
 *
 * Real PGlite + the real diff SQL; the PBM client is stubbed at its seam and
 * Discord at its send function (CORE-TEST-006 — nothing reaches pinballmap.com or
 * discord.com). The cases that matter are the ones a mocked-DB test could not
 * prove: that the ON CONFLICT diff really only yields unseen entries, that the
 * first run seeds without announcing, and that a failed post leaves the row
 * pending instead of losing the discovery.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pinballmapCatalog,
  pinballmapRegionSeenMachines,
} from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import type { PbmRegionLmx, PbmRegionLocation } from "~/lib/pinballmap/types";
import type { DiscordSendResult } from "~/lib/discord/client";
import type * as CatalogModule from "~/lib/pinballmap/catalog";

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Route the production db import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

/** What PBM "currently shows" for the region, plus per-endpoint call counters. */
const pbm = {
  entries: [] as PbmRegionLmx[],
  locations: [] as PbmRegionLocation[],
  /** When set, `fetchRegionLocations` rejects with it instead of returning. */
  locationsError: null as Error | null,
  calls: 0,
  locationCalls: 0,
  regions: [] as string[],
};

vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({
      fetchRegionLmxes: (region: string) => {
        pbm.calls += 1;
        pbm.regions.push(region);
        return Promise.resolve(pbm.entries);
      },
      fetchRegionLocations: (region: string) => {
        pbm.locationCalls += 1;
        pbm.regions.push(region);
        if (pbm.locationsError) return Promise.reject(pbm.locationsError);
        return Promise.resolve(pbm.locations);
      },
    }),
}));

/**
 * The catalog mirror's refresh-on-miss seam. `refreshCatalog` is stubbed rather
 * than run so nothing reaches pinballmap.com (CORE-TEST-006); `seeds` is what a
 * successful refresh would have written.
 */
const catalog = {
  refreshCalls: 0,
  error: null as Error | null,
  seeds: [] as { machineId: number; name: string }[],
};

vi.mock("~/lib/pinballmap/catalog", async () => {
  const actual = await vi.importActual<typeof CatalogModule>(
    "~/lib/pinballmap/catalog"
  );
  return {
    ...actual,
    refreshCatalog: async () => {
      catalog.refreshCalls += 1;
      if (catalog.error) throw catalog.error;
      if (catalog.seeds.length > 0) await seedCatalog(catalog.seeds);
      return catalog.seeds.length;
    },
  };
});

const discord = {
  hasToken: true,
  result: { ok: true } as DiscordSendResult,
  posts: [] as { channelId: string; content: string }[],
};

vi.mock("~/lib/discord/config", () => ({
  getDiscordBotToken: () =>
    Promise.resolve(discord.hasToken ? "bot-token" : null),
}));

vi.mock("~/lib/discord/client", () => ({
  postChannelMessage: (input: { channelId: string; content: string }) => {
    discord.posts.push({
      channelId: input.channelId,
      content: input.content,
    });
    return Promise.resolve(discord.result);
  },
}));

// Import AFTER the mocks so the module picks up PGlite + the stubs.
const { runRegionNewMachineAlerts } =
  await import("~/lib/pinballmap/region-alerts");

/** The region endpoint carries ids only — no names, in any shape. */
function lmx(
  overrides: Partial<PbmRegionLmx> & { lmxId: number }
): PbmRegionLmx {
  return { locationId: 26454, machineId: 6412, ...overrides };
}

async function seenRows(): Promise<
  { lmxId: number; announcedAt: Date | null }[]
> {
  const db = await getTestDb();
  return db
    .select({
      lmxId: pinballmapRegionSeenMachines.lmxId,
      announcedAt: pinballmapRegionSeenMachines.announcedAt,
    })
    .from(pinballmapRegionSeenMachines);
}

/**
 * Seed the catalog mirror — the only source of a machine's title.
 *
 * `refreshedAt` is a parameter because the refresh-on-miss cooldown reads
 * `max(refreshedAt)`: seeding at the default "now" means the mirror was just
 * refreshed, which correctly suppresses an on-demand refresh. Tests that want the
 * refresh to fire must seed a mirror that is older than the cooldown.
 */
async function seedCatalog(
  entries: { machineId: number; name: string }[],
  refreshedAt = new Date()
): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapCatalog).values(
    entries.map((e) => ({
      pinballmapMachineId: e.machineId,
      name: e.name,
      refreshedAt,
    }))
  );
}

/**
 * Un-announce every seen row, so a bootstrap back-fill can be reused as a large
 * pending backlog without fetching 600+ entries a second time.
 */
async function markAllPending(): Promise<void> {
  const db = await getTestDb();
  await db.update(pinballmapRegionSeenMachines).set({ announcedAt: null });
}

/** A mirror last written long enough ago that the cooldown has expired. */
const STALE_MIRROR = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

describe("PinballMap region new-machine alerts (PGlite)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.stubEnv("DISCORD_PBM_ALERT_CHANNEL_ID", "channel-1");
    pbm.entries = [];
    pbm.locations = [
      { locationId: 26454, name: "Austin Pinball Collective" },
      { locationId: 999, name: "Pinballz Arcade" },
    ];
    pbm.locationsError = null;
    pbm.calls = 0;
    pbm.locationCalls = 0;
    pbm.regions = [];
    catalog.refreshCalls = 0;
    catalog.error = null;
    catalog.seeds = [];
    discord.hasToken = true;
    discord.result = { ok: true };
    discord.posts = [];
  });

  it("bootstraps the seen-set on the first run without announcing anything", async () => {
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 7 })];

    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({
      region: "austin",
      skipped: null,
      observed: 2,
      bootstrapped: true,
      discovered: 2,
      announced: 0,
      pending: 0,
    });
    // No flood: everything was born already-announced.
    expect(discord.posts).toEqual([]);
    const rows = await seenRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.announcedAt !== null)).toBe(true);
    // And a bootstrap never spends the second call — there is nothing to name.
    expect(pbm.locationCalls).toBe(0);
  });

  it("announces only entries it has not seen before, named from our own data", async () => {
    await seedCatalog([
      { machineId: 6412, name: "Godzilla (Premium)" },
      { machineId: 7, name: "Medieval Madness" },
    ]);
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    pbm.entries = [
      lmx({ lmxId: 1 }),
      lmx({ lmxId: 2, locationId: 999, machineId: 7 }),
    ];
    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({
      bootstrapped: false,
      observed: 2,
      discovered: 1,
      announced: 1,
      pending: 0,
    });
    expect(discord.posts).toHaveLength(1);
    expect(discord.posts[0]?.channelId).toBe("channel-1");
    // The title came from the catalog mirror and the venue from the bulk
    // region-locations read — the LMX payload carries neither.
    expect(discord.posts[0]?.content).toContain("Medieval Madness");
    expect(discord.posts[0]?.content).toContain("Pinballz Arcade");
    // The already-seen entry is not re-announced.
    expect(discord.posts[0]?.content).not.toContain("Godzilla");
    // Exactly one locations call, and only because there was news.
    expect(pbm.locationCalls).toBe(1);
  });

  it("falls back to ids when neither lookup can name the entry", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    // Catalog never seeded (a title added upstream since the last refresh), and
    // the venue is absent from the region-locations payload.
    pbm.entries = [
      lmx({ lmxId: 1 }),
      lmx({ lmxId: 2, locationId: 4242, machineId: 31337 }),
    ];
    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ discovered: 1, announced: 1 });
    expect(discord.posts[0]?.content).toContain("PinballMap machine #31337");
    expect(discord.posts[0]?.content).toContain("location #4242");
  });

  it("still announces when the locations lookup THROWS, naming venues by id", async () => {
    // Distinct from the case above: there the locations call succeeded and simply
    // did not contain the venue. Here the call itself fails — a PBM outage or a
    // 429 on the second request of the run. A venue label is nice to have, so
    // `resolveLabels` swallows it; what must NOT happen is the whole run failing
    // and stranding a discovery that the seen-set has already recorded.
    await seedCatalog([{ machineId: 7, name: "Medieval Madness" }]);
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    pbm.locationsError = new Error("PinballMap fetchRegionLocations failed");
    pbm.entries = [
      lmx({ lmxId: 1 }),
      lmx({ lmxId: 2, locationId: 999, machineId: 7 }),
    ];
    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ discovered: 1, announced: 1, pending: 0 });
    // The machine title survives — it comes from our own mirror, not from PBM.
    expect(discord.posts[0]?.content).toContain("Medieval Madness");
    // The venue falls back to its id rather than taking the run down with it.
    expect(discord.posts[0]?.content).toContain("location #999");
    // And the row is marked announced, so it is not re-posted next run.
    expect(await seenRows()).toContainEqual(
      expect.objectContaining({ lmxId: 2, announcedAt: expect.any(Date) })
    );
  });

  it("refreshes the catalog when a discovered machine is unknown, then names it", async () => {
    // The Bon Jovi case: a title revealed and on a floor inside one week, while
    // our mirror only refreshes on Sundays. A Discord post is immutable, so
    // getting the name right on the first try is the whole point.
    await seedCatalog([{ machineId: 6412, name: "Godzilla" }], STALE_MIRROR);
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();
    catalog.refreshCalls = 0;

    // 9999 is absent from the mirror; the refresh is what teaches it.
    catalog.seeds = [{ machineId: 9999, name: "Bon Jovi (Premium)" }];
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 9999 })];
    const run = await runRegionNewMachineAlerts();

    expect(catalog.refreshCalls).toBe(1);
    expect(run).toMatchObject({ discovered: 1, announced: 1 });
    expect(discord.posts[0]?.content).toContain("Bon Jovi (Premium)");
    expect(discord.posts[0]?.content).not.toContain("PinballMap machine #9999");
  });

  it("does NOT refresh when every discovered machine already resolves", async () => {
    // The assertion that stops this becoming an hourly full-catalog fetch. On an
    // ordinary run the mirror answers and PBM's largest payload is never touched.
    await seedCatalog(
      [
        { machineId: 6412, name: "Godzilla" },
        { machineId: 7, name: "Medieval Madness" },
      ],
      STALE_MIRROR
    );
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();
    catalog.refreshCalls = 0;

    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 7 })];
    const run = await runRegionNewMachineAlerts();

    expect(catalog.refreshCalls).toBe(0);
    expect(run).toMatchObject({ announced: 1 });
    expect(discord.posts[0]?.content).toContain("Medieval Madness");
  });

  it("announces with the id fallback when a refresh does not resolve the name", async () => {
    // PBM has not catalogued it either. The alert must still go out — withholding
    // it to wait for a name means it never happens.
    await seedCatalog([{ machineId: 6412, name: "Godzilla" }], STALE_MIRROR);
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();
    catalog.refreshCalls = 0;

    catalog.seeds = []; // refresh succeeds but teaches nothing
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 9999 })];
    const run = await runRegionNewMachineAlerts();

    expect(catalog.refreshCalls).toBe(1);
    expect(run).toMatchObject({ announced: 1, pending: 0 });
    expect(discord.posts[0]?.content).toContain("PinballMap machine #9999");
    // And the row is marked announced, so it is not retried forever.
    expect(await seenRows()).toContainEqual(
      expect.objectContaining({ lmxId: 2, announcedAt: expect.any(Date) })
    );
  });

  it("does not re-trigger a refresh within the cooldown", async () => {
    // The guard against an id that is missing and STAYS missing turning every
    // hourly run into a full catalog fetch.
    await seedCatalog([{ machineId: 6412, name: "Godzilla" }], STALE_MIRROR);
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    // First unknown id: refresh fires, writes rows stamped NOW, and resolves
    // nothing for 9999.
    catalog.seeds = [{ machineId: 4242, name: "Something Else" }];
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 9999 })];
    await runRegionNewMachineAlerts();
    expect(catalog.refreshCalls).toBe(1);

    // Second unknown id, same run window: the mirror is now fresh, so no refresh.
    catalog.seeds = [];
    pbm.entries = [
      lmx({ lmxId: 1 }),
      lmx({ lmxId: 2, machineId: 9999 }),
      lmx({ lmxId: 3, machineId: 8888 }),
    ];
    const run = await runRegionNewMachineAlerts();

    expect(catalog.refreshCalls).toBe(1);
    expect(run).toMatchObject({ discovered: 1, announced: 1 });
    expect(discord.posts.at(-1)?.content).toContain("PinballMap machine #8888");
  });

  it("still announces when the catalog refresh itself throws", async () => {
    await seedCatalog([{ machineId: 6412, name: "Godzilla" }], STALE_MIRROR);
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();
    catalog.refreshCalls = 0;

    catalog.error = new Error("PinballMap fetchCatalog failed");
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 9999 })];
    const run = await runRegionNewMachineAlerts();

    expect(catalog.refreshCalls).toBe(1);
    // The alert is the product; the name is an enhancement.
    expect(run).toMatchObject({ announced: 1, pending: 0 });
    expect(discord.posts[0]?.content).toContain("PinballMap machine #9999");
  });

  it("posts nothing when the region is unchanged", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();
    discord.posts = [];
    pbm.locationCalls = 0;

    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ discovered: 0, announced: 0, pending: 0 });
    expect(discord.posts).toEqual([]);
    // A quiet day costs exactly one PBM request.
    expect(pbm.locationCalls).toBe(0);
  });

  it("does NOT announce a re-add inside PBM's 7-day window — same lmx id", async () => {
    // PBM soft-deletes an xref and, on a re-add within 7 days, revives THAT row:
    // same id, same created_at, only updated_at moves. The machine was not a new
    // arrival, so the channel should stay quiet.
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 7 })];
    await runRegionNewMachineAlerts();
    discord.posts = [];

    // Removed: it simply stops appearing (deleted rows are invisible to the API).
    pbm.entries = [lmx({ lmxId: 1 })];
    const whileGone = await runRegionNewMachineAlerts();
    expect(whileGone).toMatchObject({ discovered: 0, announced: 0 });

    // Re-added within the window: PBM hands back the SAME id.
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 7 })];
    const revived = await runRegionNewMachineAlerts();

    expect(revived).toMatchObject({ discovered: 0, announced: 0, pending: 0 });
    expect(discord.posts).toEqual([]);
  });

  it("DOES announce a re-add past the window — PBM mints a fresh lmx id", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    // Same machine, same location, but the revival window has expired so the
    // re-add creates a new xref. By now it really is a return to the floor.
    pbm.entries = [lmx({ lmxId: 77 })];
    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ discovered: 1, announced: 1 });
    expect(discord.posts).toHaveLength(1);
  });

  it("keeps a discovery pending when the Discord post fails, then announces it next run", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    discord.result = { ok: false, reason: "transient" };
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 7 })];
    const failed = await runRegionNewMachineAlerts();

    expect(failed).toMatchObject({ discovered: 1, announced: 0, pending: 1 });
    const pendingRow = (await seenRows()).find((r) => r.lmxId === 2);
    expect(pendingRow?.announcedAt).toBeNull();

    // Next run: nothing new upstream, but the pending row is retried.
    discord.result = { ok: true };
    const retried = await runRegionNewMachineAlerts();
    expect(retried).toMatchObject({ discovered: 0, announced: 1, pending: 0 });
    const settled = (await seenRows()).find((r) => r.lmxId === 2);
    expect(settled?.announcedAt).not.toBeNull();
  });

  it("makes no Pinball Map call when the shared bot token is unavailable", async () => {
    discord.hasToken = false;
    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ skipped: "not_configured" });
    expect(pbm.calls).toBe(0);
    expect(discord.posts).toEqual([]);
  });

  it("does not resolve labels when the shared bot token is unavailable", async () => {
    discord.hasToken = false;
    const locationCallsBefore = pbm.locationCalls;
    const refreshCallsBefore = catalog.refreshCalls;

    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ skipped: "not_configured" });
    expect(pbm.locationCalls).toBe(locationCallsBefore);
    expect(catalog.refreshCalls).toBe(refreshCallsBefore);
  });

  it("reports the real remaining backlog when it exceeds one run's read limit", async () => {
    // `readPending` caps at PENDING_READ_LIMIT (500), so a long Discord outage
    // can queue more than one run can drain. `pending` is the job's monitoring
    // signal, so it has to be counted, not inferred from "we announced them all".
    pbm.entries = Array.from({ length: 620 }, (_, i) =>
      lmx({ lmxId: i + 1, machineId: 1 })
    );
    await runRegionNewMachineAlerts(); // bootstrap: born announced
    await markAllPending();

    discord.hasToken = true;
    const run = await runRegionNewMachineAlerts();

    expect(run.announced).toBe(500);
    expect(run.pending).toBe(120);
  });

  it("re-bootstraps instead of announcing when one run discovers a huge share of the region", async () => {
    // The flood this guards: PBM returns a TRUNCATED first payload, the region
    // bootstraps on a handful of entries, and the next run reads the rest of the
    // region as brand-new arrivals. Neither existing guard catches it — the
    // payload is neither empty nor implausibly large.
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts(); // truncated bootstrap: 1 of 300

    pbm.entries = Array.from({ length: 300 }, (_, i) => lmx({ lmxId: i + 1 }));
    const run = await runRegionNewMachineAlerts();

    expect(run.discovered).toBe(299);
    expect(run.announced).toBe(0);
    expect(run.pending).toBe(0);
    // Nothing posted, and the seen-set self-heals: every row is now announced,
    // so the next genuine arrival is the only thing that can be announced.
    expect(discord.posts).toEqual([]);
    const rows = await seenRows();
    expect(rows).toHaveLength(300);
    expect(rows.every((r) => r.announcedAt !== null)).toBe(true);
  });

  it("still announces a normal day's arrivals, well under the re-bootstrap ceiling", async () => {
    // The guard must not swallow real discoveries — this is the case it would
    // break if the threshold were set anywhere near a plausible hour.
    await seedCatalog([{ machineId: 6412, name: "Godzilla (Premium)" }]);
    pbm.entries = Array.from({ length: 300 }, (_, i) => lmx({ lmxId: i + 1 }));
    await runRegionNewMachineAlerts();

    pbm.entries = [...pbm.entries, lmx({ lmxId: 901 }), lmx({ lmxId: 902 })];
    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ discovered: 2, announced: 2, pending: 0 });
    expect(discord.posts).toHaveLength(1);
  });

  it("makes no PBM call at all when no alert channel is configured", async () => {
    vi.stubEnv("DISCORD_PBM_ALERT_CHANNEL_ID", "");
    pbm.entries = [lmx({ lmxId: 1 })];

    const run = await runRegionNewMachineAlerts();

    expect(run.skipped).toBe("not_configured");
    expect(pbm.calls).toBe(0);
    expect(await seenRows()).toEqual([]);
  });

  it("treats an empty region payload as a bad read, not an empty region", async () => {
    pbm.entries = [];

    const run = await runRegionNewMachineAlerts();

    expect(run.skipped).toBe("empty_payload");
    // Nothing recorded, so the next good read still bootstraps rather than
    // announcing the whole region.
    expect(await seenRows()).toEqual([]);
  });

  it("reads the Austin region by default and does exactly one bulk call", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();
    expect(pbm.calls).toBe(1);
    expect(pbm.regions).toEqual(["austin"]);
  });

  it("lowercases the region before anything can use it", async () => {
    // A mis-cased region does not 404 on PBM — the LMX scope silently goes
    // UNSCOPED and returns every xref on Earth. Normalizing is the fix.
    pbm.entries = [lmx({ lmxId: 1 })];
    const run = await runRegionNewMachineAlerts({ region: "  AuStIn " });
    expect(run.region).toBe("austin");
    expect(pbm.regions).toEqual(["austin"]);
  });

  it("aborts without writing when a payload is implausibly large", async () => {
    // What an unscoped query looks like: far more entries than any real metro.
    pbm.entries = Array.from({ length: 20_001 }, (_, i) =>
      lmx({ lmxId: i + 1 })
    );

    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({
      skipped: "implausible_payload",
      observed: 20_001,
      discovered: 0,
      announced: 0,
    });
    // Nothing stored: recording a global dump would poison the region forever.
    expect(await seenRows()).toEqual([]);
    expect(discord.posts).toEqual([]);
  });
});

describe("GET /api/cron/pinballmap-region-alerts", () => {
  setupTestDb();

  const CRON_SECRET = "test-cron-secret";
  const url = "http://localhost/api/cron/pinballmap-region-alerts";

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("DISCORD_PBM_ALERT_CHANNEL_ID", "channel-1");
    pbm.entries = [lmx({ lmxId: 1 })];
    pbm.locations = [];
    pbm.calls = 0;
    pbm.locationCalls = 0;
    discord.posts = [];
    discord.hasToken = true;
    discord.result = { ok: true };
  });

  it("rejects a wrong bearer with 401", async () => {
    const { GET } =
      await import("~/app/api/cron/pinballmap-region-alerts/route");
    const res = await GET(
      new Request(url, { headers: { authorization: "Bearer nope" } })
    );
    expect(res.status).toBe(401);
  });

  it("makes no PBM call without the shared bot token", async () => {
    discord.hasToken = false;
    const { GET } =
      await import("~/app/api/cron/pinballmap-region-alerts/route");
    const res = await GET(
      new Request(url, { headers: { authorization: `Bearer ${CRON_SECRET}` } })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      region: "austin",
      skipped: "not_configured",
    });
    expect(pbm.calls).toBe(0);
  });

  it("runs independently of tracked-location configuration", async () => {
    const { GET } =
      await import("~/app/api/cron/pinballmap-region-alerts/route");
    const res = await GET(
      new Request(url, { headers: { authorization: `Bearer ${CRON_SECRET}` } })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      region: "austin",
      bootstrapped: true,
      discovered: 1,
    });
    expect(pbm.calls).toBe(1);
  });
});
