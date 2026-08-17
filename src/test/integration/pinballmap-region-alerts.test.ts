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
  pinballmapRegionSeenMachines,
  pinballmapState,
} from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import type { PbmRegionLmx } from "~/lib/pinballmap/types";
import type { DiscordSendResult } from "~/lib/discord/client";

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Route the production db import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

/** What PBM "currently shows" for the region, plus a call counter. */
const pbm = {
  entries: [] as PbmRegionLmx[],
  calls: 0,
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
    }),
}));

const discord = {
  enabled: true,
  result: { ok: true } as DiscordSendResult,
  posts: [] as { channelId: string; content: string }[],
};

vi.mock("~/lib/discord/config", () => ({
  getDiscordConfig: () =>
    Promise.resolve(
      discord.enabled
        ? { enabled: true, botToken: "bot-token", guildId: null }
        : null
    ),
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

function lmx(
  overrides: Partial<PbmRegionLmx> & { lmxId: number }
): PbmRegionLmx {
  return {
    locationId: 26454,
    machineId: 6412,
    locationName: "Austin Pinball Collective",
    machineName: "Godzilla (Premium)",
    ...overrides,
  };
}

async function seenRows(): Promise<
  { lmxId: number; announcedAt: Date | null; machineName: string | null }[]
> {
  const db = await getTestDb();
  return db
    .select({
      lmxId: pinballmapRegionSeenMachines.lmxId,
      announcedAt: pinballmapRegionSeenMachines.announcedAt,
      machineName: pinballmapRegionSeenMachines.machineName,
    })
    .from(pinballmapRegionSeenMachines);
}

describe("PinballMap region new-machine alerts (PGlite)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.stubEnv("DISCORD_PBM_ALERT_CHANNEL_ID", "channel-1");
    pbm.entries = [];
    pbm.calls = 0;
    pbm.regions = [];
    discord.enabled = true;
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
  });

  it("announces only entries it has not seen before", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    pbm.entries = [
      lmx({ lmxId: 1 }),
      lmx({
        lmxId: 2,
        locationId: 999,
        machineId: 7,
        machineName: "Medieval Madness",
        locationName: "Pinballz Arcade",
      }),
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
    expect(discord.posts[0]?.content).toContain("Medieval Madness");
    expect(discord.posts[0]?.content).toContain("Pinballz Arcade");
    // The already-seen entry is not re-announced.
    expect(discord.posts[0]?.content).not.toContain("Godzilla");
  });

  it("posts nothing when the region is unchanged", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();
    discord.posts = [];

    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ discovered: 0, announced: 0, pending: 0 });
    expect(discord.posts).toEqual([]);
  });

  it("treats a re-added machine as new — PBM mints a fresh lmx id", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    // Same machine at the same location, removed and re-added on PBM.
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

  it("keeps rows pending when the Discord integration is unavailable", async () => {
    pbm.entries = [lmx({ lmxId: 1 })];
    await runRegionNewMachineAlerts();

    discord.enabled = false;
    pbm.entries = [lmx({ lmxId: 1 }), lmx({ lmxId: 2, machineId: 7 })];
    const run = await runRegionNewMachineAlerts();

    expect(run).toMatchObject({ discovered: 1, announced: 0, pending: 1 });
    expect(discord.posts).toEqual([]);
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
});

describe("GET /api/cron/pinballmap-region-alerts", () => {
  setupTestDb();

  const CRON_SECRET = "test-cron-secret";
  const url = "http://localhost/api/cron/pinballmap-region-alerts";

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("DISCORD_PBM_ALERT_CHANNEL_ID", "channel-1");
    pbm.entries = [lmx({ lmxId: 1 })];
    pbm.calls = 0;
    discord.posts = [];
    discord.enabled = true;
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

  it("is dormant (no PBM call) while the integration is disabled", async () => {
    const { GET } =
      await import("~/app/api/cron/pinballmap-region-alerts/route");
    const res = await GET(
      new Request(url, { headers: { authorization: `Bearer ${CRON_SECRET}` } })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: "disabled" });
    expect(pbm.calls).toBe(0);
  });

  it("runs the pass when the integration is enabled", async () => {
    const db = await getTestDb();
    await db
      .insert(pinballmapState)
      .values({ id: "singleton", enabled: true, locationId: 26454 });

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
