/**
 * The activity summary's period claim and history reads, against the real
 * driver (PP-ogup, discord-activity-summary §3.2, §3.5).
 *
 * The PGlite suite (`src/test/integration/discord-activity-summary.test.ts`)
 * covers the behavior. This file exists because the runner binds JS `Date`s —
 * the claim's optimistic `summary_period_end = <read value>` and every period
 * bound in the history queries — and PGlite's driver encodes a `Date` that
 * postgres.js would reject when it reaches raw SQL untyped (PP-hbi0). Here the
 * production `~/server/db` module runs unmocked against the local Supabase
 * Postgres, so a bind postgres.js cannot encode fails this test.
 *
 * It writes the shared singleton config row, so it restores the row's summary
 * columns afterwards. Discord is stubbed at its send function and token
 * accessor (CORE-TEST-006).
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/lib/discord/config", () => ({
  getDiscordBotToken: () => Promise.resolve("bot-token"),
  getDiscordConfig: () =>
    Promise.resolve({ botToken: "bot-token", guildId: "guild" }),
}));

const posts = vi.hoisted(() => [] as string[]);
vi.mock("~/lib/discord/client", () => ({
  DISCORD_MESSAGE_FLAGS: { SUPPRESS_EMBEDS: 1 << 2 },
  postChannelMessage: (input: { content: string }) => {
    posts.push(input.content);
    return Promise.resolve({ ok: true });
  },
}));

const { runScheduledActivitySummary, sendActivitySummaryNow } =
  await import("~/lib/discord/activity-summary/runner");

const CHANNEL = "123456789012345678";
const SUMMARY_COLUMNS = {
  summaryChannelId: discordIntegrationConfig.summaryChannelId,
  summaryIntervalHours: discordIntegrationConfig.summaryIntervalHours,
  summaryStartHour: discordIntegrationConfig.summaryStartHour,
  summaryEvents: discordIntegrationConfig.summaryEvents,
  summaryStatus: discordIntegrationConfig.summaryStatus,
  summaryStatusDetail: discordIntegrationConfig.summaryStatusDetail,
  summaryLastPostAt: discordIntegrationConfig.summaryLastPostAt,
  summaryPeriodEnd: discordIntegrationConfig.summaryPeriodEnd,
  summaryPinballMapReviewKeys:
    discordIntegrationConfig.summaryPinballMapReviewKeys,
};

let saved: Awaited<ReturnType<typeof readSummaryColumns>> | undefined;
let rowExisted = false;

async function readSummaryColumns() {
  const [row] = await db
    .select(SUMMARY_COLUMNS)
    .from(discordIntegrationConfig)
    .where(eq(discordIntegrationConfig.id, "singleton"));
  return row;
}

describe("activity summary on the real driver", () => {
  beforeAll(async () => {
    saved = await readSummaryColumns();
    rowExisted = saved !== undefined;
    const fields = {
      summaryChannelId: CHANNEL,
      summaryIntervalHours: 24,
      summaryStartHour: 18,
      summaryPeriodEnd: null,
      summaryPinballMapReviewKeys: null,
    };
    await db
      .insert(discordIntegrationConfig)
      .values({ id: "singleton", ...fields })
      .onConflictDoUpdate({ target: discordIntegrationConfig.id, set: fields });
  });

  afterAll(async () => {
    if (rowExisted && saved) {
      await db
        .update(discordIntegrationConfig)
        .set(saved)
        .where(eq(discordIntegrationConfig.id, "singleton"));
    } else {
      await db
        .delete(discordIntegrationConfig)
        .where(eq(discordIntegrationConfig.id, "singleton"));
    }
  });

  it("claims each period by its stored end, reads the period's history, and records Send summary now", async () => {
    // First period: the claim matches a NULL end.
    const first = await runScheduledActivitySummary({
      now: new Date("2026-10-03T23:10:00Z"),
    });
    expect(["posted", "quiet"]).toContain(first.outcome);
    expect((await readSummaryColumns())?.summaryPeriodEnd?.toISOString()).toBe(
      "2026-10-03T23:00:00.000Z"
    );

    // Next period: the claim compares the stored end to a bound Date.
    const second = await runScheduledActivitySummary({
      now: new Date("2026-10-04T23:10:00Z"),
    });
    expect(second).toEqual(
      expect.objectContaining({
        periodStart: "2026-10-03T23:00:00.000Z",
        periodEnd: "2026-10-04T23:00:00.000Z",
      })
    );
    expect(["posted", "quiet"]).toContain(second.outcome);

    // Send summary now always posts and ends the current period.
    const sendAt = new Date("2026-10-05T15:00:00Z");
    const before = posts.length;
    expect(await sendActivitySummaryNow({ now: sendAt })).toEqual(
      expect.objectContaining({ ok: true })
    );
    expect(posts.length).toBeGreaterThan(before);
    const stored = await readSummaryColumns();
    expect(stored?.summaryPeriodEnd?.toISOString()).toBe(sendAt.toISOString());
    expect(stored?.summaryStatus).toBe("posting");
  });
});
