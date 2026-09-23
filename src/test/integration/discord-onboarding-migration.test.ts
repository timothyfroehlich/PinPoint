import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { notificationPreferences, userProfiles } from "~/server/db/schema";
import { createTestUser } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

const migrationStatements = readFileSync(
  resolve("drizzle/0079_discord-notification-onboarding.sql"),
  "utf8"
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

describe("0076 Discord notification onboarding migration", () => {
  setupTestDb();

  it("marks linked accounts onboarded without changing their preferences", async () => {
    const db = await getTestDb();
    const [linked, unlinked, linkedWithoutPreferences] = await db
      .insert(userProfiles)
      .values([
        createTestUser({
          email: "linked-migration@example.com",
          discordUserId: "discord-linked-migration",
        }),
        createTestUser({
          email: "unlinked-migration@example.com",
          discordUserId: null,
        }),
        createTestUser({
          email: "linked-no-prefs@example.com",
          discordUserId: "discord-linked-no-prefs",
        }),
      ])
      .returning();
    await db.insert(notificationPreferences).values([
      {
        userId: linked.id,
        discordEnabled: false,
        discordNotifyOnAssigned: false,
        discordNotifyOnStatusChange: true,
        discordNotifyOnNewComment: true,
        discordNotifyOnMentioned: false,
        discordNotifyOnNewIssue: false,
        discordWatchNewIssuesGlobal: true,
        suppressOwnActions: false,
      },
      { userId: unlinked.id },
    ]);

    await db.execute(sql`
      ALTER TABLE notification_preferences
        DROP COLUMN discord_onboarded_at,
        DROP COLUMN discord_notice_version
    `);
    for (const statement of migrationStatements) {
      await db.execute(sql.raw(statement));
    }

    const linkedPreferences = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, linked.id),
    });
    expect(linkedPreferences).toMatchObject({
      discordEnabled: false,
      discordNotifyOnAssigned: false,
      discordNotifyOnStatusChange: true,
      discordNotifyOnNewComment: true,
      discordNotifyOnMentioned: false,
      discordNotifyOnNewIssue: false,
      discordWatchNewIssuesGlobal: true,
      suppressOwnActions: false,
      discordNoticeVersion: 0,
    });
    expect(linkedPreferences?.discordOnboardedAt).toBeInstanceOf(Date);

    const unlinkedPreferences =
      await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, unlinked.id),
      });
    expect(unlinkedPreferences?.discordOnboardedAt).toBeNull();

    const insertedPreferences =
      await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, linkedWithoutPreferences.id),
      });
    expect(insertedPreferences?.discordOnboardedAt).toBeInstanceOf(Date);
    expect(insertedPreferences?.discordNoticeVersion).toBe(0);
  });
});
