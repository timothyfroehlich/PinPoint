import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { buildDefaultPrefs } from "~/lib/notifications/default-preferences";
import { notificationPreferences } from "~/server/db/schema";

describe("buildDefaultPrefs", () => {
  // Fails CI when a schema change (e.g. a new non-null column with no literal
  // default) breaks the derivation, instead of failing first in production
  // dispatch for a recipient with no preferences row.
  it("derives a complete row from the real notification_preferences schema", () => {
    const prefs = buildDefaultPrefs("user-1");

    expect(prefs.userId).toBe("user-1");
    expect(Object.keys(prefs).sort()).toEqual(
      Object.keys(getTableColumns(notificationPreferences)).sort()
    );
  });

  it("matches the column defaults a freshly inserted row would hold", () => {
    const prefs = buildDefaultPrefs("user-1");

    expect(prefs).toMatchObject({
      emailEnabled: true,
      inAppEnabled: true,
      discordEnabled: true,
      suppressOwnActions: false,
      emailNotifyOnAssigned: true,
      emailNotifyOnStatusChange: false,
      emailNotifyOnNewComment: false,
      inAppNotifyOnNewIssue: false,
      discordNotifyOnNewIssue: true,
      discordNoticeVersion: 0,
      discordOnboardedAt: null,
      discordNoticeLeaseId: null,
    });
  });
});
