/**
 * Integration Test: the Discord activity summary (PP-ogup,
 * discord-activity-summary spec §3–§5).
 *
 * Real PGlite throughout; Discord is stubbed at its send function and token
 * accessor (CORE-TEST-006).
 *
 * The history suite drives the REAL issue and machine services to write the
 * timeline a period is reconstructed from, so the reader is checked against
 * the events production actually writes — a renamed event field or a new
 * write path that skips the log fails here, where a fixture of hand-written
 * rows could not notice (§5.1–§5.4).
 *
 * The runner suite proves what a mocked DB could not: that the period claim
 * lets one run post per post time (§3.5), that a quiet period is claimed
 * without posting (§3.6), that a failed post is not retried (§3.7), that a
 * missing token spends nothing, that Send summary now ends the current period
 * (§3.8–§3.10), and that the Pinball Map rows trigger a post only when they
 * change (§5.11).
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscordSendResult } from "~/lib/discord/client";
import {
  ACTIVITY_SUMMARY_EVENT_KEYS,
  DEFAULT_ACTIVITY_SUMMARY_EVENTS,
} from "~/lib/discord/activity-summary/events";
import type { LocationSnapshot } from "~/lib/pinballmap/types";
import { plainTextToDoc } from "~/lib/tiptap/types";
import { getSiteUrl } from "~/lib/url";
import {
  authUsers,
  discordIntegrationConfig,
  issueComments,
  issues,
  machines,
  pinballmapCatalog,
  pinballmapState,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/notifications", () => ({
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  planNotifications: vi.fn().mockResolvedValue({ deliveries: [] }),
  getChannels: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const discord = vi.hoisted(() => ({
  hasToken: true,
  hasServerId: true,
  result: { ok: true } as DiscordSendResult,
  posts: [] as { channelId: string; content: string; flags?: number }[],
}));

vi.mock("~/lib/discord/config", () => ({
  getDiscordBotToken: () =>
    Promise.resolve(discord.hasToken ? "bot-token" : null),
  // Configured only with a token AND a server ID (discord.md §2.2).
  getDiscordConfig: () =>
    Promise.resolve(
      discord.hasToken && discord.hasServerId
        ? { botToken: "bot-token", guildId: "guild" }
        : null
    ),
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

const { loadActivityHistory } =
  await import("~/lib/discord/activity-summary/history");
const { buildSummaryModel } =
  await import("~/lib/discord/activity-summary/model");
const { formatSummaryMessages } =
  await import("~/lib/discord/activity-summary/message");
const { runScheduledActivitySummary, sendActivitySummaryNow } =
  await import("~/lib/discord/activity-summary/runner");
const {
  assignIssue,
  addIssueComment,
  createIssue,
  reassignIssueMachine,
  updateIssueSeverity,
  updateIssueStatus,
} = await import("~/services/issues");
const { updateMachineOwner, updateMachinePresence } =
  await import("~/services/machines");
const { anonymizeUserReferences } =
  await import("~/app/(app)/settings/account-deletion");

const TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

/** Postgres stamps to the microsecond; give the boundaries room. */
async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

async function makeUser(firstName: string, lastName: string): Promise<string> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  await db.insert(userProfiles).values({
    id,
    email: `${id}@example.com`,
    firstName,
    lastName,
    role: "admin",
  });
  return id;
}

async function makeMachine(
  initials: string,
  name: string,
  overrides: Partial<typeof machines.$inferInsert> = {}
): Promise<string> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(machines).values({
    id,
    initials,
    name,
    createdAt: TWO_DAYS_AGO,
    ...overrides,
  });
  return id;
}

async function open(
  initials: string,
  title: string,
  severity: "minor" | "major" | "unplayable",
  reportedBy: string
): Promise<string> {
  const { issue } = await createIssue({
    title,
    machineInitials: initials,
    severity,
    reportedBy,
  });
  return issue.id;
}

describe("activity summary history (PGlite, real services)", () => {
  setupTestDb();

  it("reports each fact's net change between the period's ends, from the logs the services write", async () => {
    const db = await getTestDb();
    const actor = await makeUser("Alex", "Admin");
    const sam = await makeUser("Sam", "Ortiz");
    const pat = await makeUser("Pat", "Lee");
    const bob = await makeUser("Bob", "Smith");

    const afm = await makeMachine("AFM", "Attack from Mars", { ownerId: sam });
    await makeMachine("MM", "Medieval Madness");
    const bk = await makeMachine("BK", "Black Knight");
    const eh = await makeMachine("EH", "Elvira's House of Horrors", {
      presenceStatus: "off_the_floor",
    });
    const tz = await makeMachine("TZ", "Twilight Zone");
    await makeMachine("JAWS", "Jaws");

    // ── Before the period ──
    const mm1 = await open("MM", "Drawbridge grinding", "major", actor);
    const afm1 = await open("AFM", "Flipper weak", "minor", actor);
    const tz1 = await open("TZ", "Clock slow", "minor", actor);
    await updateIssueStatus({ issueId: tz1, status: "fixed", userId: actor });
    const bk1 = await open("BK", "Magna-save dead", "unplayable", actor);

    await tick();
    const start = new Date();
    await tick();

    // ── During the period ──
    await updateIssueStatus({ issueId: mm1, status: "fixed", userId: actor });
    const afm2 = await open("AFM", "Ball stuck", "unplayable", actor);
    const afm3 = await open("AFM", "Lamp out", "minor", actor);
    await updateIssueStatus({ issueId: afm3, status: "fixed", userId: actor });
    // Changed and changed back: no severity row (§5.1).
    await updateIssueSeverity({
      issueId: afm1,
      severity: "major",
      userId: actor,
    });
    await updateIssueSeverity({
      issueId: afm1,
      severity: "minor",
      userId: actor,
    });
    await updateIssueStatus({
      issueId: afm1,
      status: "need_parts",
      userId: actor,
    });
    await assignIssue({ issueId: afm1, assignedTo: bob, actorId: actor });
    for (const text of ["Ordered a coil", "Coil arrived"]) {
      await addIssueComment({
        issueId: afm1,
        content: plainTextToDoc(text),
        userId: actor,
      });
    }
    await updateIssueStatus({ issueId: tz1, status: "new", userId: actor });
    const machineState = async (
      id: string
    ): Promise<{
      name: string;
      ownerId: string | null;
      invitedOwnerId: string | null;
      presenceStatus:
        | "on_the_floor"
        | "off_the_floor"
        | "on_loan"
        | "pending_arrival"
        | "removed";
    }> => {
      const [row] = await db
        .select({
          name: machines.name,
          ownerId: machines.ownerId,
          invitedOwnerId: machines.invitedOwnerId,
          presenceStatus: machines.presenceStatus,
        })
        .from(machines)
        .where(eq(machines.id, id));
      if (!row) throw new Error("no machine");
      return row;
    };
    // Out on loan and back: no availability row (§5.1).
    for (const presenceStatus of ["on_loan", "on_the_floor"] as const) {
      await updateMachinePresence({
        machineId: bk,
        presenceStatus,
        actorUserId: actor,
        current: await machineState(bk),
      });
    }
    await updateMachinePresence({
      machineId: eh,
      presenceStatus: "on_the_floor",
      actorUserId: actor,
      current: await machineState(eh),
    });
    await updateMachineOwner({
      machineId: afm,
      actorUserId: actor,
      current: await machineState(afm),
      newOwner: { ownerId: pat, invitedOwnerId: null },
    });
    await reassignIssueMachine({
      issueId: bk1,
      newMachineInitials: "JAWS",
      userId: actor,
    });
    // Two Pinball Map comments imported; one is deleted before the end.
    await db.insert(timelineEvents).values([
      {
        machineId: tz,
        sourceType: "pinballmap",
        tag: "pinballmap",
        eventData: { kind: "pinballmap_comment", conditionId: 1 },
      },
      {
        machineId: tz,
        sourceType: "pinballmap",
        tag: "pinballmap",
        eventData: { kind: "pinballmap_comment", conditionId: 2 },
        deletedAt: new Date(),
      },
    ]);
    await makeUser("Riley", "Chen");
    await makeMachine("GZ", "Godzilla", {
      createdAt: new Date(),
      presenceStatus: "pending_arrival",
    });

    await tick();
    const end = new Date();
    await tick();

    // ── After the period: none of this is reported ──
    await updateIssueStatus({ issueId: afm2, status: "fixed", userId: actor });
    await updateMachinePresence({
      machineId: eh,
      presenceStatus: "off_the_floor",
      actorUserId: actor,
      current: await machineState(eh),
    });
    await addIssueComment({
      issueId: afm1,
      content: plainTextToDoc("Installed"),
      userId: actor,
    });

    const history = await loadActivityHistory(
      { start, end },
      ACTIVITY_SUMMARY_EVENT_KEYS
    );
    const model = buildSummaryModel(history, ACTIVITY_SUMMARY_EVENT_KEYS);
    const summarize = (entries: typeof model.needsAttention): unknown[] =>
      entries.map((entry) => ({
        machine: entry.machine.initials,
        status: entry.statusChange,
        availability: entry.availabilityChange,
        rows: entry.rows.map((row) =>
          "issue" in row
            ? `${row.kind} ${row.issue.formattedId}`
            : row.kind === "owner"
              ? `owner ${String(row.ownerLabel)}`
              : `${row.kind} ${String(row.count)}`
        ),
      }));

    expect(summarize(model.needsAttention)).toEqual([
      {
        machine: "AFM",
        status: { from: "operational", to: "unplayable" },
        availability: null,
        rows: [
          "opened AFM-02",
          "opened_and_closed AFM-03",
          "progress AFM-01",
          "assignment AFM-01",
          "comments AFM-01",
          "owner Pat Lee",
        ],
      },
      // The reassigned issue moves the status; it is not a row of its own.
      {
        machine: "JAWS",
        status: { from: "operational", to: "unplayable" },
        availability: null,
        rows: [],
      },
    ]);
    // Both single lines, so by machine name (§6.7).
    expect(summarize(model.backInService)).toEqual([
      {
        machine: "BK",
        status: { from: "unplayable", to: "operational" },
        availability: null,
        rows: [],
      },
      {
        machine: "MM",
        status: { from: "needs_service", to: "operational" },
        availability: null,
        rows: ["closed MM-01"],
      },
    ]);
    // TZ's two changes make a block, which comes before single lines (§6.7).
    expect(summarize(model.otherChanges)).toEqual([
      {
        machine: "TZ",
        status: null,
        availability: null,
        rows: ["reopened TZ-01", "pinball_map_comments 1"],
      },
      {
        machine: "EH",
        status: null,
        availability: { from: "off_the_floor", to: "on_the_floor" },
        rows: [],
      },
    ]);
    expect(model.newMachines.map((m) => [m.initials, m.presence])).toEqual([
      ["GZ", "pending_arrival"],
    ]);
    expect(model.newMembers).toEqual(["Riley Chen"]);
    expect(model.counts).toEqual({ opened: 3, closed: 2, machinesAdded: 1 });

    const afmRows = model.needsAttention[0]?.rows ?? [];
    expect(afmRows).toContainEqual(
      expect.objectContaining({ kind: "assignment", assigneeName: "Bob Smith" })
    );
    expect(afmRows).toContainEqual(
      expect.objectContaining({ kind: "comments", count: 2 })
    );
    expect(afmRows).toContainEqual(
      expect.objectContaining({
        kind: "opened",
        suffix: { type: "severity", value: "unplayable" },
      })
    );

    // Names only, never an email (§6.10, CORE-SEC-007).
    const rendered = formatSummaryMessages({
      model,
      period: { start, end },
      siteUrl: "https://pinpoint.example",
      pinballMapSection: null,
    }).join("\n");
    expect(rendered).not.toContain("@example.com");
    expect(rendered).toContain("Riley Chen");
  });

  /**
   * Assignments name people as issue Activity does (PP-0fg0.1): by account,
   * so a rename shows the current name and is not itself a reassignment, and
   * a deleted assignee shows as Former user rather than vanishing.
   */
  it("names assignees by their current account, and a deleted one as Former user", async () => {
    const db = await getTestDb();
    const actor = await makeUser("Alex", "Admin");
    const bob = await makeUser("Bob", "Smith");
    const carol = await makeUser("Carol", "Diaz");
    const dana = await makeUser("Dana", "Park");
    await makeMachine("RN", "Rollergames");
    const rn1 = await open("RN", "Flipper weak", "minor", actor);
    const rn2 = await open("RN", "Lamp out", "minor", actor);
    const rn3 = await open("RN", "Coil hot", "minor", actor);
    const rn4 = await open("RN", "Switch flaky", "minor", actor);
    await assignIssue({ issueId: rn1, assignedTo: bob, actorId: actor });
    await assignIssue({ issueId: rn2, assignedTo: carol, actorId: actor });

    await tick();
    const start = new Date();
    await tick();

    // Assigned while still "Bob Smith"; reported under the current name.
    await assignIssue({ issueId: rn4, assignedTo: bob, actorId: actor });
    // A rename alone: RN-01 keeps the same assignee, so no row.
    await db
      .update(userProfiles)
      .set({ firstName: "Robert" })
      .where(eq(userProfiles.id, bob));
    // Reassigned to Dana, who then deletes her account: the change stays.
    await assignIssue({ issueId: rn2, assignedTo: dana, actorId: actor });
    await anonymizeUserReferences(dana, null);
    // An account deleted outside the app: the id no longer resolves, and the
    // stored name is never shown.
    await db.insert(issueComments).values({
      issueId: rn3,
      isSystem: true,
      eventData: {
        type: "assigned",
        assigneeId: randomUUID(),
        assigneeName: "Gone Elsewhere",
      },
    });

    await tick();
    const end = new Date();

    const history = await loadActivityHistory(
      { start, end },
      ACTIVITY_SUMMARY_EVENT_KEYS
    );
    const model = buildSummaryModel(history, ACTIVITY_SUMMARY_EVENT_KEYS);
    const assignments = [
      ...model.needsAttention,
      ...model.backInService,
      ...model.otherChanges,
    ]
      .flatMap((entry) => entry.rows)
      .flatMap((row) =>
        row.kind === "assignment"
          ? [`${row.issue.formattedId} ${String(row.assigneeName)}`]
          : []
      )
      .sort();
    expect(assignments).toEqual([
      "RN-02 Former user",
      "RN-03 Former user",
      "RN-04 Robert Smith",
    ]);
  });

  it("reports only what the default event types cover", async () => {
    const actor = await makeUser("Alex", "Admin");
    await makeMachine("AFM", "Attack from Mars");
    const afm1 = await open("AFM", "Flipper weak", "minor", actor);

    await tick();
    const start = new Date();
    await tick();
    await assignIssue({ issueId: afm1, assignedTo: actor, actorId: actor });
    await addIssueComment({
      issueId: afm1,
      content: plainTextToDoc("Looking"),
      userId: actor,
    });
    await tick();
    const end = new Date();

    const history = await loadActivityHistory(
      { start, end },
      DEFAULT_ACTIVITY_SUMMARY_EVENTS
    );
    const model = buildSummaryModel(history, DEFAULT_ACTIVITY_SUMMARY_EVENTS);
    expect(model.otherChanges).toEqual([]);
    expect(model.needsAttention).toEqual([]);
  });
});

// ─── Runner ────────────────────────────────────────────────────────────

const CHANNEL = "123456789012345678";
/** 6:10 PM CDT, Saturday 2026-10-03: the daily 6 PM post time. */
const SIX_PM = new Date("2026-10-03T23:10:00Z");
const SIX_PM_INSTANT = new Date("2026-10-03T23:00:00Z");
/** The same day at 7 PM: not a post time. */
const SEVEN_PM = new Date("2026-10-04T00:10:00Z");
/** The next day's post time. */
const NEXT_SIX_PM = new Date("2026-10-04T23:10:00Z");
/** 3 PM CDT, inside the period ending at 6 PM. */
const THREE_PM = new Date("2026-10-03T20:00:00Z");

async function seedConfig(
  overrides: Partial<typeof discordIntegrationConfig.$inferInsert> = {}
): Promise<void> {
  const db = await getTestDb();
  await db.insert(discordIntegrationConfig).values({
    id: "singleton",
    summaryChannelId: CHANNEL,
    summaryIntervalHours: 24,
    summaryStartHour: 18,
    ...overrides,
  });
}

/** A machine with one issue opened at `openedAt`. */
async function seedIssue(
  openedAt: Date,
  title = "Left flipper dead"
): Promise<void> {
  const db = await getTestDb();
  await db
    .insert(machines)
    .values({
      initials: "AFM",
      name: "Attack from Mars",
      createdAt: new Date("2026-09-01T00:00:00Z"),
    })
    .onConflictDoNothing();
  const existing = await db.select({ id: issues.id }).from(issues);
  await db.insert(issues).values({
    machineInitials: "AFM",
    issueNumber: existing.length + 1,
    title,
    severity: "unplayable",
    createdAt: openedAt,
  });
}

async function storedConfig(): Promise<
  typeof discordIntegrationConfig.$inferSelect
> {
  const db = await getTestDb();
  const row = await db.query.discordIntegrationConfig.findFirst();
  if (!row) throw new Error("no config row");
  return row;
}

function snapshot(machineIds: number[]): LocationSnapshot {
  return {
    locationId: 26454,
    name: "APC",
    dateLastUpdated: null,
    lastUpdatedByUsername: null,
    machineCount: machineIds.length,
    lmxes: machineIds.map((machineId) => ({
      id: 9000 + machineId,
      machineId,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    })),
    fetchedAtIso: "2026-10-03T22:00:00Z",
    raw: {},
  };
}

async function seedPinballMap(machineIds: number[]): Promise<void> {
  const db = await getTestDb();
  await db
    .insert(pinballmapCatalog)
    .values([
      { pinballmapMachineId: 501, name: "Twilight Zone" },
      { pinballmapMachineId: 502, name: "Jaws (Pro)" },
    ])
    .onConflictDoNothing();
  await db
    .insert(pinballmapState)
    .values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: snapshot(machineIds),
      lastSyncStatus: "ok",
      lastSyncedAt: new Date("2026-10-03T22:00:00Z"),
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: { snapshotJson: snapshot(machineIds) },
    });
}

describe("activity summary runner (PGlite)", () => {
  setupTestDb();

  beforeEach(() => {
    discord.hasToken = true;
    discord.hasServerId = true;
    discord.result = { ok: true };
    discord.posts = [];
  });

  it("posts once per post time, and the next period starts where it ended (§3.2, §3.5)", async () => {
    await seedConfig();
    await seedIssue(THREE_PM);

    expect(await runScheduledActivitySummary({ now: SEVEN_PM })).toEqual({
      outcome: "skipped",
      reason: "off_schedule",
    });

    const first = await runScheduledActivitySummary({ now: SIX_PM });
    expect(first).toEqual({
      outcome: "posted",
      periodStart: "2026-10-02T23:00:00.000Z",
      periodEnd: "2026-10-03T23:00:00.000Z",
      messages: 1,
    });
    expect(discord.posts).toHaveLength(1);
    expect(discord.posts[0]?.channelId).toBe(CHANNEL);
    expect(discord.posts[0]?.flags).toBe(1 << 2);
    expect(discord.posts[0]?.content).toContain(
      "**PinPoint daily summary**\nOct 2, 6:00 PM to Oct 3, 6:00 PM · 1 opened"
    );
    expect(discord.posts[0]?.content).toContain("Opened [AFM-01]");

    const stored = await storedConfig();
    expect(stored.summaryStatus).toBe("posting");
    expect(stored.summaryLastPostAt).not.toBeNull();
    expect(stored.summaryPeriodEnd?.toISOString()).toBe(
      SIX_PM_INSTANT.toISOString()
    );

    // A duplicate delivery in the same hour finds the period claimed.
    expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual({
      outcome: "skipped",
      reason: "already_sent",
    });

    // The next day covers only what changed after this post: the issue is not
    // reported again, so that period is quiet.
    expect(await runScheduledActivitySummary({ now: NEXT_SIX_PM })).toEqual({
      outcome: "quiet",
      periodStart: "2026-10-03T23:00:00.000Z",
      periodEnd: "2026-10-04T23:00:00.000Z",
    });
    expect(discord.posts).toHaveLength(1);
  });

  it("claims a quiet period without posting (§3.6)", async () => {
    await seedConfig();

    expect((await runScheduledActivitySummary({ now: SIX_PM })).outcome).toBe(
      "quiet"
    );
    expect(discord.posts).toHaveLength(0);
    expect((await storedConfig()).summaryPeriodEnd?.toISOString()).toBe(
      SIX_PM_INSTANT.toISOString()
    );
  });

  it.each([
    ["a blocked channel", { ok: false, reason: "blocked" }, "cant_post"],
    ["an outage", { ok: false, reason: "transient" }, "couldnt_check"],
    [
      "a rejected token",
      { ok: false, reason: "blocked", invalidToken: true },
      "needs_discord",
    ],
  ] as const)(
    "does not retry a failed post after %s, and records why (§3.7)",
    async (_label, result, status) => {
      await seedConfig();
      await seedIssue(THREE_PM);
      discord.result = result;

      expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual(
        expect.objectContaining({ outcome: "failed", status })
      );
      expect((await storedConfig()).summaryStatus).toBe(status);

      discord.result = { ok: true };
      expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual({
        outcome: "skipped",
        reason: "already_sent",
      });
      expect(discord.posts).toHaveLength(1);
    }
  );

  it("marks the channel Needs Discord without spending the period when the token is missing", async () => {
    await seedConfig();
    await seedIssue(THREE_PM);
    discord.hasToken = false;

    expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual({
      outcome: "skipped",
      reason: "needs_discord",
    });
    const stored = await storedConfig();
    expect(stored.summaryStatus).toBe("needs_discord");
    expect(stored.summaryPeriodEnd).toBeNull();

    discord.hasToken = true;
    expect((await runScheduledActivitySummary({ now: SIX_PM })).outcome).toBe(
      "posted"
    );
  });

  it("posts nothing once Discord is turned off by clearing the server ID (§2.4)", async () => {
    await seedConfig();
    await seedIssue(THREE_PM);
    discord.hasServerId = false;

    expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual({
      outcome: "skipped",
      reason: "needs_discord",
    });
    expect(await sendActivitySummaryNow({ now: SIX_PM })).toEqual(
      expect.objectContaining({ ok: false, reason: "needs_discord" })
    );
    expect(discord.posts).toHaveLength(0);
    expect((await storedConfig()).summaryPeriodEnd).toBeNull();
  });

  it("Send summary now never moves the period end back past a claimed post time (§3.5, §3.10)", async () => {
    await seedConfig();
    await seedIssue(THREE_PM);

    // The 6 PM run claims and posts while a Send summary now that started
    // just before 6 PM is still in flight.
    expect((await runScheduledActivitySummary({ now: SIX_PM })).outcome).toBe(
      "posted"
    );
    const justBefore = new Date(SIX_PM_INSTANT.getTime() - 2000);
    expect((await sendActivitySummaryNow({ now: justBefore })).ok).toBe(true);

    expect((await storedConfig()).summaryPeriodEnd?.toISOString()).toBe(
      SIX_PM_INSTANT.toISOString()
    );
    // A duplicate delivery of the 6 PM run still finds the period claimed.
    expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual({
      outcome: "skipped",
      reason: "already_sent",
    });
    expect(discord.posts).toHaveLength(2);
  });

  it("posts nothing while Disabled or without a channel (§2.4)", async () => {
    await seedConfig({ summaryIntervalHours: null });
    await seedIssue(THREE_PM);
    expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual({
      outcome: "skipped",
      reason: "disabled",
    });

    const db = await getTestDb();
    await db
      .update(discordIntegrationConfig)
      .set({ summaryIntervalHours: 24, summaryChannelId: null });
    expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual({
      outcome: "skipped",
      reason: "no_channel",
    });
    expect(await sendActivitySummaryNow({ now: SIX_PM })).toEqual({
      ok: false,
      reason: "no_channel",
    });
    expect(discord.posts).toHaveLength(0);
  });

  it("Send summary now posts the interval ending now and ends the current period (§3.8, §3.10)", async () => {
    await seedConfig();
    await seedIssue(new Date("2026-10-03T16:00:00Z")); // 11 AM CDT
    const sendAt = new Date("2026-10-03T21:00:00Z"); // 4 PM CDT

    expect(await sendActivitySummaryNow({ now: sendAt })).toEqual({
      ok: true,
      messages: 1,
    });
    expect(discord.posts[0]?.content).toContain(
      "Oct 2, 4:00 PM to Oct 3, 4:00 PM · 1 opened"
    );
    const stored = await storedConfig();
    expect(stored.summaryPeriodEnd?.toISOString()).toBe(sendAt.toISOString());
    expect(stored.summaryStatus).toBe("posting");

    // The 6 PM summary covers only 4 PM to 6 PM, so it is quiet.
    expect(await runScheduledActivitySummary({ now: SIX_PM })).toEqual({
      outcome: "quiet",
      periodStart: sendAt.toISOString(),
      periodEnd: SIX_PM_INSTANT.toISOString(),
    });
    expect(discord.posts).toHaveLength(1);
  });

  it("Send summary now covers the last 24 hours while Disabled, and says when there is nothing to report (§3.8, §3.9)", async () => {
    await seedConfig({ summaryIntervalHours: null });
    const sendAt = new Date("2026-10-03T21:00:00Z");
    await seedIssue(new Date("2026-10-02T22:00:00Z"), "Inside the day"); // 23 h before
    await seedIssue(new Date("2026-10-02T20:00:00Z"), "Before the day"); // 25 h before

    expect((await sendActivitySummaryNow({ now: sendAt })).ok).toBe(true);
    expect(discord.posts[0]?.content).toContain("Inside the day");
    expect(discord.posts[0]?.content).not.toContain("Before the day");

    // A day later nothing new has happened: it still posts, saying so.
    const nextDay = new Date("2026-10-05T21:00:00Z");
    expect((await sendActivitySummaryNow({ now: nextDay })).ok).toBe(true);
    expect(discord.posts[1]?.content).toBe(
      "**PinPoint daily summary**\nOct 4, 4:00 PM to Oct 5, 4:00 PM\nNothing to report."
    );
  });

  it("a failed Send summary now changes nothing but the status (§3.10)", async () => {
    await seedConfig();
    await seedIssue(THREE_PM);
    discord.result = { ok: false, reason: "blocked" };

    expect(await sendActivitySummaryNow({ now: THREE_PM })).toEqual({
      ok: false,
      reason: "cant_post",
      statusDetail: "Channel unreachable or bot missing permissions",
    });
    const stored = await storedConfig();
    expect(stored.summaryPeriodEnd).toBeNull();
    expect(stored.summaryStatus).toBe("cant_post");
  });

  it("posts for a Pinball Map change only after the first period sets the baseline (§5.11)", async () => {
    await seedConfig();
    await seedPinballMap([501]);

    // First period: no stored rows, so today's rows are the baseline.
    expect((await runScheduledActivitySummary({ now: SIX_PM })).outcome).toBe(
      "quiet"
    );
    expect((await storedConfig()).summaryPinballMapReviewKeys).toEqual([
      "pinball_map_only:entry-9501",
    ]);

    // A row added on Pinball Map: the next period posts the section alone.
    await seedPinballMap([501, 502]);
    expect(
      (await runScheduledActivitySummary({ now: NEXT_SIX_PM })).outcome
    ).toBe("posted");
    expect(discord.posts[0]?.content).toBe(
      [
        "**PinPoint daily summary**",
        "Oct 3, 6:00 PM to Oct 4, 6:00 PM",
        "### 📍 Pinball Map",
        "2 to review",
        "**On Pinball Map, not linked: 2**",
        "Jaws (Pro), Twilight Zone",
        `[Review the lineup](<${getSiteUrl()}/m/pinball-map>)`,
        "*Lineup data from [Pinball Map](<https://pinballmap.com/map/?by_location_id=26454>) (CC BY-SA 4.0).*",
      ].join("\n")
    );

    // Unchanged the day after: quiet again.
    expect(
      (
        await runScheduledActivitySummary({
          now: new Date("2026-10-05T23:10:00Z"),
        })
      ).outcome
    ).toBe("quiet");
    expect(discord.posts).toHaveLength(1);
  });
});
