import { describe, it, expect } from "vitest";
import { emailChannel } from "~/lib/notifications/channels/email-channel";
import { inAppChannel } from "~/lib/notifications/channels/in-app-channel";
import type { NotificationPreferencesRow } from "~/lib/notifications/channels/types";

function prefs(
  overrides: Partial<NotificationPreferencesRow> = {}
): NotificationPreferencesRow {
  return {
    userId: "u",
    emailEnabled: true,
    inAppEnabled: true,
    suppressOwnActions: false,
    emailNotifyOnAssigned: true,
    inAppNotifyOnAssigned: true,
    emailNotifyOnStatusChange: false,
    inAppNotifyOnStatusChange: false,
    emailNotifyOnNewComment: true,
    inAppNotifyOnNewComment: true,
    emailNotifyOnMentioned: true,
    inAppNotifyOnMentioned: true,
    emailNotifyOnNewIssue: true,
    inAppNotifyOnNewIssue: false,
    emailWatchNewIssuesGlobal: false,
    inAppWatchNewIssuesGlobal: false,
    ...overrides,
  };
}

describe("emailChannel.shouldDeliver", () => {
  it("returns false when emailEnabled is false", () => {
    expect(
      emailChannel.shouldDeliver(
        prefs({ emailEnabled: false }),
        "issue_assigned"
      )
    ).toBe(false);
  });

  it("returns true for issue_assigned when enabled + granular on", () => {
    expect(
      emailChannel.shouldDeliver(
        prefs({ emailEnabled: true, emailNotifyOnAssigned: true }),
        "issue_assigned"
      )
    ).toBe(true);
  });

  it("returns false for issue_assigned when granular off", () => {
    expect(
      emailChannel.shouldDeliver(
        prefs({ emailNotifyOnAssigned: false }),
        "issue_assigned"
      )
    ).toBe(false);
  });

  it("always returns true for machine_ownership_changed (critical event)", () => {
    expect(
      emailChannel.shouldDeliver(prefs(), "machine_ownership_changed")
    ).toBe(true);
  });

  it("OR-s per-event and global flag for new_issue", () => {
    expect(
      emailChannel.shouldDeliver(
        prefs({
          emailNotifyOnNewIssue: false,
          emailWatchNewIssuesGlobal: true,
        }),
        "new_issue"
      )
    ).toBe(true);
    expect(
      emailChannel.shouldDeliver(
        prefs({
          emailNotifyOnNewIssue: false,
          emailWatchNewIssuesGlobal: false,
        }),
        "new_issue"
      )
    ).toBe(false);
  });
});

describe("inAppChannel.shouldDeliver", () => {
  it("returns false when inAppEnabled is false", () => {
    expect(
      inAppChannel.shouldDeliver(
        prefs({ inAppEnabled: false }),
        "issue_assigned"
      )
    ).toBe(false);
  });

  it("returns true for mentioned when granular on", () => {
    expect(
      inAppChannel.shouldDeliver(
        prefs({ inAppNotifyOnMentioned: true }),
        "mentioned"
      )
    ).toBe(true);
  });

  it("always returns true for machine_ownership_changed", () => {
    expect(
      inAppChannel.shouldDeliver(prefs(), "machine_ownership_changed")
    ).toBe(true);
  });
});
