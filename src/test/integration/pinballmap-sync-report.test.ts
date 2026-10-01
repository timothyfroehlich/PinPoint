/**
 * Integration Test: weekly Pinball Map sync report (PP-5qwx,
 * pinballmap-sync-report spec).
 *
 * Real PGlite and the real lineup loader; Discord is stubbed at its send
 * function and token accessor (CORE-TEST-006). What a mocked-DB test could not
 * prove: that the week claim lets exactly one of the two daylight-saving cron
 * slots (or a duplicate delivery) post (§3.3), that a failed post is not
 * retried that week (§3.4), and that the report reads the stored lineup the
 * page reads (§4.1).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscordSendResult } from "~/lib/discord/client";
import type { LocationSnapshot } from "~/lib/pinballmap/types";
import { pinballmapCatalog, pinballmapState } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const discord = vi.hoisted(() => ({
  hasToken: true,
  result: { ok: true } as DiscordSendResult,
  posts: [] as { channelId: string; content: string; flags?: number }[],
}));

vi.mock("~/lib/discord/config", () => ({
  getDiscordBotToken: () =>
    Promise.resolve(discord.hasToken ? "bot-token" : null),
}));

vi.mock("~/lib/discord/client", () => ({
  DISCORD_MESSAGE_FLAGS: { SUPPRESS_EMBEDS: 1 << 2 },
  postChannelMessage: (input: {
    channelId: string;
    content: string;
    flags?: number;
  }) => {
    discord.posts.push({
      channelId: input.channelId,
      content: input.content,
      flags: input.flags,
    });
    return Promise.resolve(discord.result);
  },
}));

const { runSyncReport } = await import("~/lib/pinballmap/sync-report");

const CHANNEL = "123456789012345678";
const LOCATION_ID = 26454;
/** 6:10 PM CDT on Monday 2026-09-28 — the 23:00 UTC slot. */
const MONDAY_6PM = new Date("2026-09-28T23:10:00Z");
/** The 00:00 UTC Tuesday slot the same week — 7 PM CDT. */
const OTHER_SLOT = new Date("2026-09-29T00:00:20Z");

function snapshot(): LocationSnapshot {
  return {
    locationId: LOCATION_ID,
    name: "APC",
    dateLastUpdated: null,
    lastUpdatedByUsername: null,
    machineCount: 1,
    lmxes: [
      {
        id: 9001,
        machineId: 501,
        icEnabled: null,
        lastUpdatedByUsername: null,
        conditions: [],
      },
    ],
    fetchedAtIso: "2026-09-28T22:00:00Z",
    raw: {},
  };
}

async function seed(
  opts: { channelId?: string | null; locationId?: number | null } = {}
): Promise<void> {
  const db = await getTestDb();
  await db.insert(pinballmapState).values({
    id: "singleton",
    locationId: opts.locationId === undefined ? LOCATION_ID : opts.locationId,
    snapshotJson: snapshot(),
    lastSyncStatus: "ok",
    lastSyncedAt: new Date("2026-09-28T22:00:00Z"),
    syncReportChannelId:
      opts.channelId === undefined ? CHANNEL : opts.channelId,
  });
  await db.insert(pinballmapCatalog).values({
    pinballmapMachineId: 501,
    name: "Attack from Mars",
  });
}

async function storedReportState(): Promise<{
  status: string;
  detail: string | null;
  lastPostAt: Date | null;
  lastWeek: string | null;
}> {
  const db = await getTestDb();
  const row = await db.query.pinballmapState.findFirst();
  if (!row) throw new Error("no state row");
  return {
    status: row.syncReportStatus,
    detail: row.syncReportLastStatusDetail,
    lastPostAt: row.syncReportLastPostAt,
    lastWeek: row.syncReportLastWeek,
  };
}

describe("runSyncReport (PGlite)", () => {
  setupTestDb();

  beforeEach(() => {
    discord.hasToken = true;
    discord.result = { ok: true };
    discord.posts = [];
  });

  it("posts the stored lineup's review state once per week, with link previews suppressed", async () => {
    await seed();

    const first = await runSyncReport({ now: MONDAY_6PM });
    expect(first).toEqual({ outcome: "posted", week: "2026-09-28" });
    expect(discord.posts).toHaveLength(1);
    expect(discord.posts[0]?.channelId).toBe(CHANNEL);
    expect(discord.posts[0]?.flags).toBe(1 << 2);
    expect(discord.posts[0]?.content).toContain(
      "**On Pinball Map, not linked: 1**\nAttack from Mars"
    );

    const stored = await storedReportState();
    expect(stored.status).toBe("posting");
    expect(stored.lastPostAt).not.toBeNull();
    expect(stored.lastWeek).toBe("2026-09-28");

    // A duplicate delivery in the same hour finds the week claimed.
    expect(await runSyncReport({ now: MONDAY_6PM })).toEqual({
      outcome: "skipped",
      reason: "already_sent",
    });
    expect(discord.posts).toHaveLength(1);
  });

  it("does nothing on the cron slot that is not 6 PM Central", async () => {
    await seed();

    expect(await runSyncReport({ now: OTHER_SLOT })).toEqual({
      outcome: "skipped",
      reason: "off_schedule",
    });
    expect(discord.posts).toHaveLength(0);
    expect((await storedReportState()).lastWeek).toBeNull();
  });

  it("does not retry a failed post that week, and records why it failed", async () => {
    await seed();
    discord.result = { ok: false, reason: "blocked" };

    expect(await runSyncReport({ now: MONDAY_6PM })).toEqual({
      outcome: "failed",
      week: "2026-09-28",
      status: "cant_post",
    });
    expect((await storedReportState()).status).toBe("cant_post");

    discord.result = { ok: true };
    expect(await runSyncReport({ now: MONDAY_6PM })).toEqual({
      outcome: "skipped",
      reason: "already_sent",
    });
    expect(discord.posts).toHaveLength(1);
  });

  it.each([
    ["no report channel", { channelId: null }, "no_channel"],
    ["Pinball Map not configured", { locationId: null }, "not_configured"],
  ] as const)("posts nothing with %s", async (_label, opts, reason) => {
    await seed(opts);

    expect(await runSyncReport({ now: MONDAY_6PM })).toEqual({
      outcome: "skipped",
      reason,
    });
    expect(discord.posts).toHaveLength(0);
    expect((await storedReportState()).lastWeek).toBeNull();
  });

  it("marks the channel Needs Discord without spending the week when the bot token is missing", async () => {
    await seed();
    discord.hasToken = false;

    expect(await runSyncReport({ now: MONDAY_6PM })).toEqual({
      outcome: "skipped",
      reason: "needs_discord",
    });
    const stored = await storedReportState();
    expect(stored.status).toBe("needs_discord");
    expect(stored.lastWeek).toBeNull();

    // The week was not spent, so a run in the same hour after the token is
    // fixed still posts.
    discord.hasToken = true;
    expect((await runSyncReport({ now: MONDAY_6PM })).outcome).toBe("posted");
  });
});
