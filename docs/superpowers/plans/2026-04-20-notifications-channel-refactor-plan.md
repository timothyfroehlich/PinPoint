# Notifications Channel Dispatcher Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the hardcoded email + in-app dispatch blocks in `src/lib/notifications.ts` into a function-based channel registry, so PR 4 can add Discord as a third channel without a Rule-of-Three violation. No behavior change, no schema change, no env var change — every existing notification test must pass unchanged.

**Architecture:** Split `src/lib/notifications.ts` into a thin orchestrator (`dispatch.ts`) and a per-channel directory. Each channel is a plain object `{ key, shouldDeliver, deliver }` living in its own file. A `getChannels()` function returns the active channel list (a function so later PRs can make Discord opt-out on missing config). Dispatcher calls `channel.shouldDeliver(prefs, type)` then `channel.deliver(...)` under `Promise.allSettled`. `suppressOwnActions`, recipient resolution, the `new_issue` watcher logic, and the internal-account email guard all stay — `suppressOwnActions` at the top (cross-channel), the internal-account guard inside the email channel (email-specific).

**Tech Stack:** TypeScript (ts-strictest), Drizzle ORM, Vitest (unit + PGlite integration), `Promise.allSettled`. Module re-exports from `src/lib/notifications.ts` preserve every existing import path.

**Spec:** `docs/superpowers/specs/2026-04-19-discord-integration-design.md` § "PR 1 — Notifications channel dispatcher refactor" (decisions #1, #2, #3).

**Bead:** `PP-734` (claimed). Blocks `PP-2n5` (PR 4: Discord DM channel) and `PP-gk6` (follow-up: consolidate email formatting into `email-channel.ts`).

---

## Summary of the move

| Old location                                                          | New location                                        | Status                                             |
| --------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| `src/lib/notifications.ts` (340 lines, orchestrator + email + in-app) | `src/lib/notifications/dispatch.ts`                 | Orchestrator only: recipients, prefs, `allSettled` |
| (hardcoded in-app block in `notifications.ts` ~L282-290)              | `src/lib/notifications/channels/in-app-channel.ts`  | `NotificationChannel` implementation               |
| (hardcoded email block in `notifications.ts` ~L292-318)               | `src/lib/notifications/channels/email-channel.ts`   | `NotificationChannel` implementation               |
| n/a                                                                   | `src/lib/notifications/channels/types.ts`           | `NotificationChannel`, `ChannelContext` types      |
| n/a                                                                   | `src/lib/notifications/channels/registry.ts`        | `getChannels()` function                           |
| n/a                                                                   | `src/lib/notifications/channels/discord-channel.ts` | Scaffold stub (not registered) — used by PR 4      |
| `src/lib/notifications.ts` (same path)                                | `src/lib/notifications.ts`                          | **Shim** — re-exports from new location            |

**Public API stability:** `createNotification`, `CreateNotificationProps`, `NotificationType` all still import from `~/lib/notifications`. No caller changes. The 8 callers (`src/services/issues.ts`, `src/services/issues.test.ts`, `src/test/integration/notifications.test.ts`, `src/test/integration/database-queries.test.ts`, `src/app/(app)/m/actions.ts`, `src/lib/notification-formatting.ts`, `src/components/notifications/NotificationList.tsx`, `src/test/integration/machine-owner-promotion.test.ts`) remain untouched.

**Migration strategy:** **Shim re-export, staged per task.** Each task below produces an isolated, committable change with green tests. Tasks 2-4 build the new module in parallel files (old `notifications.ts` untouched). Task 5 flips `notifications.ts` to a thin orchestrator that uses the new channels. Task 6 deletes any dead code and verifies integration tests still pass.

**Rollout:** No behavior flag. The spec (decision #18) only introduces conditional registration for Discord in PR 4; email + in-app are always registered.

---

## File structure after this PR

```
src/lib/
├── notifications.ts                  # NEW: thin shim re-exporting from ./notifications/dispatch
└── notifications/
    ├── dispatch.ts                    # NEW: createNotification + recipient resolution
    └── channels/
        ├── types.ts                   # NEW: NotificationChannel contract + ChannelContext
        ├── registry.ts                # NEW: getChannels()
        ├── email-channel.ts           # NEW: email delivery (moved from notifications.ts)
        ├── in-app-channel.ts          # NEW: in-app row insert (moved from notifications.ts)
        └── discord-channel.ts         # NEW: stub scaffold (throws if invoked — PR 4 implements)
```

---

### Task 1: Create channel type contracts

**Files:**

- Create: `src/lib/notifications/channels/types.ts`
- Test: none (types only)

- [ ] **Step 1: Write the types file**

```typescript
// src/lib/notifications/channels/types.ts
import type { DbTransaction } from "~/server/db";
import type { notificationPreferences } from "~/server/db/schema";
import type { NotificationType } from "~/lib/notifications/dispatch";

/**
 * Preferences row shape — matches Drizzle's inferred select type for
 * `notificationPreferences`. Kept as a type alias so channels don't
 * need to import the Drizzle table.
 */
export type NotificationPreferencesRow =
  typeof notificationPreferences.$inferSelect;

/**
 * Per-notification context assembled by the dispatcher and passed to
 * every channel. Channels read only the fields they need.
 */
export interface ChannelContext {
  userId: string;
  type: NotificationType;
  resourceId: string;
  resourceType: "issue" | "machine";
  // Recipient profile data
  email: string | null;
  // Resolved at the top of createNotification before the fan-out
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
  issueDescription?: string | undefined;
  // The Drizzle transaction/db handle for channels that write to the DB
  // (in-app channel inserts a `notifications` row).
  tx: DbTransaction;
}

/**
 * Delivery result — discriminated so later PRs (specifically PR 5's
 * Discord failure detection) can react to specific failure kinds
 * without catching exceptions.
 */
export type DeliveryResult =
  | { ok: true }
  | { ok: false; reason: "transient" | "permanent" | "skipped" };

/**
 * The channel contract. Channels are plain objects (decision #1) —
 * no classes, no DI framework. Closures over transport deps are
 * created inside each channel module.
 */
export interface NotificationChannel {
  /** Stable identifier used for logging and (in PR 4) telemetry. */
  readonly key: "email" | "in_app" | "discord";
  /**
   * Pure predicate over preferences + event type.
   * Returns true if this channel wants to deliver for this recipient.
   * MUST NOT perform I/O. MUST NOT throw.
   */
  shouldDeliver(
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean;
  /**
   * Perform the actual delivery. Called concurrently with other
   * channels under Promise.allSettled. Errors are caught and logged
   * by the dispatcher — channels should still handle their own
   * expected failures.
   */
  deliver(ctx: ChannelContext): Promise<DeliveryResult>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: No errors. (This task imports `NotificationType` from `~/lib/notifications/dispatch` which does not exist yet — **expect a missing-module error here**. Fixed in Task 2. This is deliberate: we do not commit Task 1 on its own.)

- [ ] **Step 3: Do NOT commit yet**

Rationale: Task 1's types depend on Task 2's module. Combine the commit at the end of Task 2.

---

### Task 2: Extract orchestrator into `notifications/dispatch.ts`

**Files:**

- Create: `src/lib/notifications/dispatch.ts`
- Modify: `src/lib/notifications/channels/types.ts` (no change — already imports from this module)
- Test: existing integration tests (run but not modified)

- [ ] **Step 1: Write `dispatch.ts` with the full orchestrator**

The file below is the complete new `dispatch.ts`. It is a copy-edit of the current `src/lib/notifications.ts` with three changes: (a) exports are split by purpose, (b) the email block and in-app block are removed from the final loop — replaced with a channel fan-out call (Task 5 adds this call; for now, keep the two blocks inline so integration tests still pass when run standalone against this file), (c) imports adjusted for the new location.

```typescript
// src/lib/notifications/dispatch.ts
import { eq, inArray } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import {
  notifications,
  notificationPreferences,
  userProfiles,
  issues,
  issueWatchers,
  machines,
  machineWatchers,
} from "~/server/db/schema";
import type { IssueWatcher } from "~/lib/types/database";
import { sendEmail } from "~/lib/email/client";
import { log } from "~/lib/logger";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { getEmailHtml, getEmailSubject } from "~/lib/notification-formatting";

type NotificationPreferences = typeof notificationPreferences.$inferSelect;

export type NotificationType =
  | "issue_assigned"
  | "issue_status_changed"
  | "new_comment"
  | "new_issue"
  | "machine_ownership_changed"
  | "mentioned";

type ResourceType = "issue" | "machine";

export interface CreateNotificationProps {
  type: NotificationType;
  resourceId: string;
  resourceType: ResourceType;
  actorId?: string | undefined;
  includeActor?: boolean | undefined;
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
  issueDescription?: string | undefined;
  additionalRecipientIds?: string[] | undefined;
}

export async function createNotification(
  {
    type,
    resourceId,
    resourceType,
    actorId,
    includeActor = true,
    issueTitle,
    machineName,
    formattedIssueId,
    commentContent,
    newStatus,
    issueDescription,
    additionalRecipientIds,
  }: CreateNotificationProps,
  tx: DbTransaction = db
): Promise<void> {
  log.debug(
    { type, resourceId, actorId, action: "createNotification" },
    "Creating notification"
  );

  // 1. Determine recipients
  const recipientIds = new Set<string>();

  const addRecipients = (...ids: (string | null | undefined)[]): void => {
    ids.forEach((id) => {
      if (id) recipientIds.add(id);
    });
  };

  addRecipients(...(additionalRecipientIds ?? []));

  let resolvedIssueTitle = issueTitle;
  let resolvedMachineName = machineName;
  let resolvedFormattedIssueId = formattedIssueId;

  if (type === "new_issue") {
    let machineId: string | null;

    if (resourceType === "issue") {
      const issue = await tx.query.issues.findFirst({
        where: eq(issues.id, resourceId),
        with: { machine: true },
      });
      machineId = issue?.machine.id ?? null;
      resolvedIssueTitle = resolvedIssueTitle ?? issue?.title;
      resolvedMachineName = resolvedMachineName ?? issue?.machine.name;
    } else {
      const machine = await tx.query.machines.findFirst({
        where: eq(machines.id, resourceId),
        columns: { id: true, name: true },
      });
      machineId = machine?.id ?? null;
      resolvedMachineName = resolvedMachineName ?? machine?.name;
    }

    if (!resolvedFormattedIssueId && resourceType === "issue") {
      const issue = await tx.query.issues.findFirst({
        where: eq(issues.id, resourceId),
        columns: { issueNumber: true, machineInitials: true },
      });
      if (issue) {
        resolvedFormattedIssueId = `${issue.machineInitials}-${String(issue.issueNumber).padStart(2, "0")}`;
      }
    }

    const globalSubscribers = await tx.query.notificationPreferences.findMany({
      where: (prefs, { or, eq }) =>
        or(
          eq(prefs.emailWatchNewIssuesGlobal, true),
          eq(prefs.inAppWatchNewIssuesGlobal, true)
        ),
    });

    addRecipients(...globalSubscribers.map((p) => p.userId));

    if (machineId) {
      const watchersList = await tx.query.machineWatchers.findMany({
        where: eq(machineWatchers.machineId, machineId),
      });

      addRecipients(...watchersList.map((w) => w.userId));

      if (resourceType === "issue") {
        const fullSubscribers = watchersList.filter(
          (w) => w.watchMode === "subscribe"
        );

        if (fullSubscribers.length > 0) {
          await tx
            .insert(issueWatchers)
            .values(
              fullSubscribers.map((w) => ({
                issueId: resourceId,
                userId: w.userId,
              }))
            )
            .onConflictDoNothing();
        }
      }
    }
  } else if (
    resourceType === "issue" &&
    type !== "issue_assigned" &&
    type !== "mentioned"
  ) {
    const watchers = await tx.query.issueWatchers.findMany({
      where: eq(issueWatchers.issueId, resourceId),
    });

    addRecipients(...watchers.map((w: IssueWatcher) => w.userId));
  }

  if (includeActor && actorId) {
    recipientIds.add(actorId);
  }
  if (actorId && !includeActor) {
    recipientIds.delete(actorId);
  }

  if (recipientIds.size === 0) return;

  // 2. Fetch preferences
  const preferences = await tx.query.notificationPreferences.findMany({
    where: inArray(notificationPreferences.userId, [...recipientIds]),
  });
  const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

  // 3. Fetch emails (avoid N+1)
  const users = await tx
    .select({ id: userProfiles.id, email: userProfiles.email })
    .from(userProfiles)
    .where(inArray(userProfiles.id, [...recipientIds]));
  const emailMap = new Map(users.map((u) => [u.id, u.email]));

  // 4. Fan out per recipient — behavior preserved, inline for this task.
  //    (Task 5 replaces this block with a channel registry call.)
  const notificationsToInsert: Array<{
    userId: string;
    type: NotificationType;
    resourceId: string;
    resourceType: ResourceType;
  }> = [];
  const emailsToSend: Array<{ to: string; subject: string; html: string }> = [];

  for (const userId of recipientIds) {
    const prefs =
      (prefsMap.get(userId) as NotificationPreferences | undefined) ??
      buildDefaultPrefs(userId);

    if (actorId && userId === actorId && prefs.suppressOwnActions) {
      continue;
    }

    let emailNotify = false;
    let inAppNotify = false;

    switch (type) {
      case "issue_assigned":
        emailNotify = prefs.emailNotifyOnAssigned;
        inAppNotify = prefs.inAppNotifyOnAssigned;
        break;
      case "issue_status_changed":
        emailNotify = prefs.emailNotifyOnStatusChange;
        inAppNotify = prefs.inAppNotifyOnStatusChange;
        break;
      case "new_comment":
        emailNotify = prefs.emailNotifyOnNewComment;
        inAppNotify = prefs.inAppNotifyOnNewComment;
        break;
      case "new_issue": {
        emailNotify =
          prefs.emailNotifyOnNewIssue || prefs.emailWatchNewIssuesGlobal;
        inAppNotify =
          prefs.inAppNotifyOnNewIssue || prefs.inAppWatchNewIssuesGlobal;
        break;
      }
      case "machine_ownership_changed":
        emailNotify = true;
        inAppNotify = true;
        break;
      case "mentioned":
        emailNotify = prefs.emailNotifyOnMentioned;
        inAppNotify = prefs.inAppNotifyOnMentioned;
        break;
    }

    if (prefs.inAppEnabled && inAppNotify) {
      notificationsToInsert.push({ userId, type, resourceId, resourceType });
    }

    if (prefs.emailEnabled && emailNotify) {
      const email = emailMap.get(userId);
      if (email && !isInternalAccount(email)) {
        emailsToSend.push({
          to: email,
          subject: getEmailSubject(
            type,
            resolvedIssueTitle,
            resolvedMachineName,
            resolvedFormattedIssueId,
            newStatus
          ),
          html: getEmailHtml({
            type,
            issueTitle: resolvedIssueTitle,
            machineName: resolvedMachineName,
            formattedIssueId: resolvedFormattedIssueId,
            commentContent,
            newStatus,
            userId,
            issueDescription,
          }),
        });
      }
    }
  }

  if (notificationsToInsert.length > 0) {
    log.debug(
      { count: notificationsToInsert.length, action: "createNotification" },
      "Inserting notifications"
    );
    await tx.insert(notifications).values(notificationsToInsert);
  }

  if (emailsToSend.length > 0) {
    await Promise.all(
      emailsToSend.map((email) =>
        sendEmail(email).catch((err: unknown) => {
          log.error({ err }, "Failed to send email notification");
        })
      )
    );
  }
}

/**
 * Fallback prefs when a user has no row in notification_preferences.
 * Extracted so channels can reuse the exact defaults in Task 4.
 */
function buildDefaultPrefs(userId: string): NotificationPreferences {
  return {
    userId,
    emailEnabled: true,
    inAppEnabled: true,
    suppressOwnActions: false,
    emailNotifyOnAssigned: true,
    inAppNotifyOnAssigned: true,
    emailNotifyOnStatusChange: false,
    inAppNotifyOnStatusChange: false,
    emailNotifyOnNewComment: false,
    inAppNotifyOnNewComment: false,
    emailNotifyOnMentioned: true,
    inAppNotifyOnMentioned: true,
    emailNotifyOnNewIssue: true,
    inAppNotifyOnNewIssue: false,
    emailWatchNewIssuesGlobal: false,
    inAppWatchNewIssuesGlobal: false,
    emailNotifyOnMachineOwnershipChange: false,
    inAppNotifyOnMachineOwnershipChange: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

- [ ] **Step 2: Replace `src/lib/notifications.ts` with a shim**

```typescript
// src/lib/notifications.ts
// Shim — public API preserved. Real logic in ./notifications/dispatch.
export {
  createNotification,
  type NotificationType,
  type CreateNotificationProps,
} from "./notifications/dispatch";
```

- [ ] **Step 3: Fix the circular import in `notification-formatting.ts`**

`notification-formatting.ts` currently imports `type NotificationType` from `~/lib/notifications`. After the shim flip, that re-export works but creates a circular dependency chain (`notifications.ts` → `dispatch.ts` → `notification-formatting.ts` → `notifications.ts`). Break it by pointing the type import directly at the new source:

```typescript
// src/lib/notification-formatting.ts — line 5 only
import { type NotificationType } from "~/lib/notifications/dispatch";
```

Leave every other import of `~/lib/notifications` alone — public API stays stable via the shim.

- [ ] **Step 4: Run type check**

Run: `pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: No errors.

- [ ] **Step 5: Run notification tests**

Run: `pnpm exec vitest run src/test/integration/notifications.test.ts src/lib/auth/internal-accounts-notifications.test.ts src/test/unit/notification-formatting.test.ts 2>&1 | tail -30`
Expected: All tests pass. Specifically the 676-line `notifications.test.ts` integration suite — zero changes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications.ts src/lib/notifications/dispatch.ts src/lib/notification-formatting.ts src/lib/notifications/channels/types.ts
git commit -m "refactor(notifications): extract dispatch orchestrator and channel types (PP-734)"
```

---

### Task 3: Write unit tests for channel contract — failing

**Files:**

- Create: `src/test/unit/notification-channels.test.ts`

We TDD the channel contract before wiring channels in. These tests verify that each channel's `shouldDeliver` is a pure predicate matching the switch statement in `dispatch.ts`.

- [ ] **Step 1: Write the failing test file**

```typescript
// src/test/unit/notification-channels.test.ts
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
    emailNotifyOnMachineOwnershipChange: false,
    inAppNotifyOnMachineOwnershipChange: false,
    createdAt: new Date(),
    updatedAt: new Date(),
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
```

- [ ] **Step 2: Run the test to confirm it fails for the right reason**

Run: `pnpm exec vitest run src/test/unit/notification-channels.test.ts 2>&1 | tail -20`
Expected: FAIL with `Cannot find module '~/lib/notifications/channels/email-channel'` (and same for in-app). Module does not exist yet.

- [ ] **Step 3: Do NOT commit yet — Task 4 makes it pass**

---

### Task 4: Implement email and in-app channels

**Files:**

- Create: `src/lib/notifications/channels/email-channel.ts`
- Create: `src/lib/notifications/channels/in-app-channel.ts`
- Create: `src/lib/notifications/channels/discord-channel.ts` (stub)
- Create: `src/lib/notifications/channels/registry.ts`

- [ ] **Step 1: Write the email channel**

```typescript
// src/lib/notifications/channels/email-channel.ts
import { sendEmail } from "~/lib/email/client";
import { log } from "~/lib/logger";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { getEmailHtml, getEmailSubject } from "~/lib/notification-formatting";
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

export const emailChannel: NotificationChannel = {
  key: "email",
  shouldDeliver(
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean {
    if (!prefs.emailEnabled) return false;
    switch (type) {
      case "issue_assigned":
        return prefs.emailNotifyOnAssigned;
      case "issue_status_changed":
        return prefs.emailNotifyOnStatusChange;
      case "new_comment":
        return prefs.emailNotifyOnNewComment;
      case "new_issue":
        return prefs.emailNotifyOnNewIssue || prefs.emailWatchNewIssuesGlobal;
      case "machine_ownership_changed":
        // Critical event — preferences cannot opt out (only main switch can).
        return true;
      case "mentioned":
        return prefs.emailNotifyOnMentioned;
    }
  },
  async deliver(ctx: ChannelContext): Promise<DeliveryResult> {
    if (!ctx.email || isInternalAccount(ctx.email)) {
      return { ok: false, reason: "skipped" };
    }

    try {
      await sendEmail({
        to: ctx.email,
        subject: getEmailSubject(
          ctx.type,
          ctx.issueTitle,
          ctx.machineName,
          ctx.formattedIssueId,
          ctx.newStatus
        ),
        html: getEmailHtml({
          type: ctx.type,
          issueTitle: ctx.issueTitle,
          machineName: ctx.machineName,
          formattedIssueId: ctx.formattedIssueId,
          commentContent: ctx.commentContent,
          newStatus: ctx.newStatus,
          userId: ctx.userId,
          issueDescription: ctx.issueDescription,
        }),
      });
      return { ok: true };
    } catch (err) {
      log.error({ err }, "Failed to send email notification");
      return { ok: false, reason: "transient" };
    }
  },
};
```

- [ ] **Step 2: Write the in-app channel**

```typescript
// src/lib/notifications/channels/in-app-channel.ts
import { notifications } from "~/server/db/schema";
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

export const inAppChannel: NotificationChannel = {
  key: "in_app",
  shouldDeliver(
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean {
    if (!prefs.inAppEnabled) return false;
    switch (type) {
      case "issue_assigned":
        return prefs.inAppNotifyOnAssigned;
      case "issue_status_changed":
        return prefs.inAppNotifyOnStatusChange;
      case "new_comment":
        return prefs.inAppNotifyOnNewComment;
      case "new_issue":
        return prefs.inAppNotifyOnNewIssue || prefs.inAppWatchNewIssuesGlobal;
      case "machine_ownership_changed":
        return true;
      case "mentioned":
        return prefs.inAppNotifyOnMentioned;
    }
  },
  async deliver(ctx: ChannelContext): Promise<DeliveryResult> {
    await ctx.tx.insert(notifications).values({
      userId: ctx.userId,
      type: ctx.type,
      resourceId: ctx.resourceId,
      resourceType: ctx.resourceType,
    });
    return { ok: true };
  },
};
```

**Note** — the current `dispatch.ts` does a _batched_ insert (one `INSERT ... VALUES (...), (...)` statement for all eligible in-app recipients). Task 5's refactor will preserve batch semantics by collecting rows in the orchestrator rather than calling `deliver()` per recipient for in-app. See Task 5 step 2 for rationale. The per-recipient `deliver()` above is correct for use once this plan's follow-ups eliminate the batch optimization; for this PR, the dispatcher batches in-app inserts instead of going through the channel's `deliver()` — documented as a minor deviation below.

**(See "Deviations" section at the end of this plan — this is the one place we diverge from the spec's "all channels go through `deliver()`" picture, for the explicit reason that behavior preservation outranks architectural purity here.)**

- [ ] **Step 3: Write the Discord stub**

```typescript
// src/lib/notifications/channels/discord-channel.ts
//
// STUB scaffolded by PR 1. NOT registered by getChannels() in this PR.
// PR 4 (bead PP-2n5) fills in sendDm, reads discord_user_id from ctx,
// and adds this channel to the registry when getDiscordConfig().enabled.
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

export const discordChannel: NotificationChannel = {
  key: "discord",
  shouldDeliver(
    _prefs: NotificationPreferencesRow,
    _type: NotificationType
  ): boolean {
    // Intentionally unreachable in PR 1 — channel is not registered.
    return false;
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  async deliver(_ctx: ChannelContext): Promise<DeliveryResult> {
    throw new Error(
      "discordChannel.deliver() invoked in PR 1 — not yet implemented. See PP-2n5."
    );
  },
};
```

- [ ] **Step 4: Write the registry**

```typescript
// src/lib/notifications/channels/registry.ts
import { emailChannel } from "./email-channel";
import { inAppChannel } from "./in-app-channel";
import type { NotificationChannel } from "./types";

/**
 * Returns the list of active notification channels.
 *
 * A function (not a const) so later PRs (see PP-2n5) can register
 * the Discord channel conditionally on `getDiscordConfig().enabled`.
 * See spec decision #18 (missing bot token → channel not registered).
 *
 * Order matters for test determinism — in-app first, then email,
 * matches the historical ordering in the monolithic dispatcher.
 */
export function getChannels(): readonly NotificationChannel[] {
  return [inAppChannel, emailChannel];
}
```

- [ ] **Step 5: Run the unit tests from Task 3 — they should pass now**

Run: `pnpm exec vitest run src/test/unit/notification-channels.test.ts 2>&1 | tail -20`
Expected: All tests pass (8 tests).

- [ ] **Step 6: Run full type check**

Run: `pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/notifications/channels/email-channel.ts src/lib/notifications/channels/in-app-channel.ts src/lib/notifications/channels/discord-channel.ts src/lib/notifications/channels/registry.ts src/test/unit/notification-channels.test.ts
git commit -m "feat(notifications): add channel registry with email, in-app, and Discord stub (PP-734)"
```

---

### Task 5: Replace the inline fan-out with a channel-registry call

**Files:**

- Modify: `src/lib/notifications/dispatch.ts`

This is the behavior-preserving refactor at the core of PR 1. We replace the inline per-recipient `if (inApp) ... if (email) ...` block with a loop that: (a) builds `ChannelContext` per recipient, (b) iterates `getChannels()`, (c) calls `shouldDeliver`, (d) collects rows for batched in-app inserts and email parameter objects for fan-out. The actual `deliver()` calls for email are invoked through `Promise.allSettled`; in-app stays batched.

- [ ] **Step 1: Rewrite the fan-out block in `dispatch.ts`**

Replace the entire "4. Fan out per recipient" block (from `const notificationsToInsert: Array<...>` through the two batch sends at the end of `createNotification`) with:

```typescript
// 4. Fan-out per recipient using the channel registry.
//    See src/lib/notifications/channels/registry.ts.
const channels = getChannels();

// Rows for batched in-app insert (preserves historical single-INSERT).
const notificationsToInsert: Array<{
  userId: string;
  type: NotificationType;
  resourceId: string;
  resourceType: ResourceType;
}> = [];

// Email dispatch is concurrent via Promise.allSettled so one slow/failed
// email doesn't block others (spec: "Promise.allSettled concurrent dispatch
// preserved").
const emailDeliveries: Array<Promise<DeliveryResult>> = [];

for (const userId of recipientIds) {
  const prefs =
    (prefsMap.get(userId) as NotificationPreferences | undefined) ??
    buildDefaultPrefs(userId);

  // Cross-channel pre-dispatch rule: skip own actions entirely.
  // (Spec decision: suppressOwnActions stays at the top of the recipient
  // loop — it is NOT per-channel.)
  if (actorId && userId === actorId && prefs.suppressOwnActions) {
    continue;
  }

  const ctx: ChannelContext = {
    userId,
    type,
    resourceId,
    resourceType,
    email: emailMap.get(userId) ?? null,
    issueTitle: resolvedIssueTitle,
    machineName: resolvedMachineName,
    formattedIssueId: resolvedFormattedIssueId,
    commentContent,
    newStatus,
    issueDescription,
    tx,
  };

  for (const channel of channels) {
    if (!channel.shouldDeliver(prefs, type)) continue;

    if (channel.key === "in_app") {
      // Batched insert — collect, don't deliver individually.
      notificationsToInsert.push({
        userId,
        type,
        resourceId,
        resourceType,
      });
    } else {
      // Email (and future Discord): fire-and-forget under allSettled.
      emailDeliveries.push(channel.deliver(ctx));
    }
  }
}

if (notificationsToInsert.length > 0) {
  log.debug(
    { count: notificationsToInsert.length, action: "createNotification" },
    "Inserting notifications"
  );
  await tx.insert(notifications).values(notificationsToInsert);
}

if (emailDeliveries.length > 0) {
  const results = await Promise.allSettled(emailDeliveries);
  for (const r of results) {
    if (r.status === "rejected") {
      // Channel.deliver() is expected to catch its own errors and return
      // {ok:false}. A rejection here means a bug — log at error level.
      log.error({ err: r.reason }, "Notification channel delivery rejected");
    }
  }
}
```

Also update imports at the top of `dispatch.ts`:

```typescript
import { getChannels } from "./channels/registry";
import type { ChannelContext, DeliveryResult } from "./channels/types";
```

And remove these imports (now unused here — they live in `email-channel.ts` and `in-app-channel.ts`):

```typescript
// DELETE these lines from dispatch.ts:
import { sendEmail } from "~/lib/email/client";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { getEmailHtml, getEmailSubject } from "~/lib/notification-formatting";
```

- [ ] **Step 2: Understand the in-app batching decision**

The spec says "`Promise.allSettled` concurrent dispatch preserved." The _current_ dispatcher does NOT use `Promise.allSettled` for in-app — it does one batched `INSERT ... VALUES`. The emails are what go through `Promise.all` today. We preserve exactly that: in-app stays batched (one SQL statement), email goes through `Promise.allSettled`.

If a subagent argues "but the channel abstraction should make in-app use `deliver()` too" — that would change behavior (N inserts instead of 1) and violate the hard acceptance contract. Follow-up bead territory.

- [ ] **Step 3: Run notification integration tests**

Run: `pnpm exec vitest run src/test/integration/notifications.test.ts 2>&1 | tail -40`
Expected: All tests pass. Zero changes to the test file.

- [ ] **Step 4: Run every test file that imports from `~/lib/notifications`**

Run: `pnpm exec vitest run src/test/integration/notifications.test.ts src/test/integration/database-queries.test.ts src/test/integration/machine-owner-promotion.test.ts src/services/issues.test.ts src/lib/auth/internal-accounts-notifications.test.ts src/test/unit/notification-formatting.test.ts src/test/unit/notification-channels.test.ts src/test/unit/issue-actions.test.ts src/test/unit/machine-actions.test.ts 2>&1 | tail -30`
Expected: All green.

- [ ] **Step 5: Run type check + lint**

Run: `pnpm exec tsc --noEmit 2>&1 | tail -10`
Expected: No errors.

Run: `pnpm exec eslint src/lib/notifications src/lib/notifications.ts src/lib/notification-formatting.ts 2>&1 | tail -20`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications/dispatch.ts
git commit -m "refactor(notifications): route dispatch through channel registry (PP-734)"
```

---

### Task 6: Run full preflight, verify zero behavior drift

**Files:**

- Modify: none (verification only)

- [ ] **Step 1: Run the full check suite**

Run: `pnpm run check 2>&1 | tail -40`
Expected: All green (types, lint, format, unit tests, yamllint, actionlint, ruff, shellcheck).

- [ ] **Step 2: Run the preflight suite**

Run: `pnpm run preflight 2>&1 | tail -40`
Expected: All green (full check + build + integration tests).

- [ ] **Step 3: Spot-check grep for any stragglers**

Run each of these via the `Grep` tool:

- `from ["']~/lib/notifications["']` — should still appear in ≥6 files (services, tests, components, actions, notification-formatting). These imports still resolve via the shim. Confirm none of them broke.
- `sendEmail` imported anywhere outside `email/` and `email-channel.ts` — should ONLY appear in `email-channel.ts` now (and the mock in `notifications.test.ts`). `dispatch.ts` must NOT import `sendEmail`.
- `getEmailHtml|getEmailSubject` imported — should appear in `email-channel.ts` only. `dispatch.ts` must not import them.
- `isInternalAccount` — should appear in `email-channel.ts` only (and the test at `internal-accounts-notifications.test.ts`).

Any stray import of the deleted helpers in `dispatch.ts` is a bug from Task 5.

- [ ] **Step 4: Verify file count and locations**

Run via Glob tool with pattern `src/lib/notifications/**/*.ts`.
Expected exactly:

```
src/lib/notifications/dispatch.ts
src/lib/notifications/channels/types.ts
src/lib/notifications/channels/registry.ts
src/lib/notifications/channels/email-channel.ts
src/lib/notifications/channels/in-app-channel.ts
src/lib/notifications/channels/discord-channel.ts
```

And `src/lib/notifications.ts` still exists as the shim.

- [ ] **Step 5: Commit nothing extra — close bead**

```bash
bd update PP-734 --status ready-for-review
```

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin plan/pr-1-notifications-refactor   # (Only the plan branch)
```

The implementation itself ships on a separate branch (typically `feat/notifications-channel-refactor-pp-734`) — this plan document is its own commit for review. Actual implementation flows through `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

---

## Test strategy summary

**Existing tests (must pass unchanged, zero edits):**

- `src/test/integration/notifications.test.ts` — 676 lines, the integration suite that exercises every branch of `createNotification`. This is the primary acceptance gate.
- `src/services/issues.test.ts` — asserts `createNotification` is called with correct args by the issue services.
- `src/test/integration/database-queries.test.ts` — touches `createNotification` through higher-level calls.
- `src/test/integration/machine-owner-promotion.test.ts` — uses `createNotification` via machine actions.
- `src/lib/auth/internal-accounts-notifications.test.ts` — confirms `isInternalAccount` behavior used by email channel.
- `src/test/unit/notification-formatting.test.ts` — unchanged; formatters didn't move.

**New test (added in Task 3):**

- `src/test/unit/notification-channels.test.ts` — unit-level coverage of each channel's `shouldDeliver` predicate. Fast (no DB), catches regressions if someone adds a new `NotificationType` but forgets a channel case.

**Explicitly NOT in scope for this PR:**

- Tests for `channel.deliver()` of email/in-app — those paths are covered via integration tests on the full dispatcher.
- Tests for `discordChannel` — it's a stub; PR 4 adds its tests.

## Risks and what could go wrong

1. **Circular import between `notifications.ts` (shim) and `notification-formatting.ts`.** `notification-formatting.ts` imports `NotificationType` from `~/lib/notifications`. After the shim flip, the chain becomes `notifications.ts → notifications/dispatch.ts → notification-formatting.ts → notifications.ts`. Mitigation: Task 2 step 3 changes `notification-formatting.ts` to import directly from `~/lib/notifications/dispatch`. Validate with `pnpm exec tsc --noEmit` at every step.

2. **In-app insert semantics drift from batched to per-row.** The spec says "all channels go through `deliver()`", which _sounds_ like in-app should do N single inserts. The current code does ONE batched insert. Going to N breaks no functional test but could regress performance on `new_issue` events with many global watchers. Mitigation: Task 5 keeps in-app batched (special case in the fan-out), documented here and in the deviations section.

3. **Mock targets in test files point at `~/lib/email/client`.** `notifications.test.ts` mocks `vi.mock("~/lib/email/client", ...)`. Since we keep calling `sendEmail` from _inside_ `email-channel.ts` (not `dispatch.ts`), Vitest's module-level `vi.mock` still applies correctly. Mitigation: Task 5 step 3 runs the mocked test suite as the sanity check.

4. **TypeScript `exactOptionalPropertyTypes` catching `ChannelContext` field mismatches.** All optional fields on `ChannelContext` are explicitly `T | undefined` (not just `T?`) so `exactOptionalPropertyTypes` doesn't reject passing through undefined values from `CreateNotificationProps`. Verified in the Task 1 type file.

5. **`getChannels()` being called per recipient vs. once per `createNotification`.** Calling per recipient is wasteful (redundant array construction) but not incorrect. Task 5 calls it once at the top of the loop. Not a correctness risk, but worth noting for code review.

6. **Order of channel iteration.** `getChannels()` returns `[inAppChannel, emailChannel]`. If a reviewer flips the order, no tests fail (email and in-app are independent), but the batched in-app INSERT happens after email fan-out. Keep in-app first — matches historical behavior and is simpler to reason about.

## Files touched (concrete list)

**New:**

- `src/lib/notifications/dispatch.ts`
- `src/lib/notifications/channels/types.ts`
- `src/lib/notifications/channels/registry.ts`
- `src/lib/notifications/channels/email-channel.ts`
- `src/lib/notifications/channels/in-app-channel.ts`
- `src/lib/notifications/channels/discord-channel.ts`
- `src/test/unit/notification-channels.test.ts`

**Modified:**

- `src/lib/notifications.ts` — reduced to a shim re-exporting from `./notifications/dispatch`.
- `src/lib/notification-formatting.ts` — one line: `NotificationType` import moved to `~/lib/notifications/dispatch` to break a circular dependency.

**Untouched callers (by design — public API stable):**

- `src/services/issues.ts`
- `src/services/issues.test.ts`
- `src/app/(app)/m/actions.ts`
- `src/components/notifications/NotificationList.tsx`
- `src/app/api/unsubscribe/route.ts`
- `src/test/integration/notifications.test.ts`
- `src/test/integration/machine-owner-promotion.test.ts`
- `src/test/integration/database-queries.test.ts`
- `src/test/unit/issue-actions.test.ts`
- `src/test/unit/machine-actions.test.ts`
- `src/test/unit/notification-formatting.test.ts`

## Deviations from the spec

1. **In-app channel uses batched INSERT, not `channel.deliver()` per recipient.** The spec's channel contract implies every channel flows through `deliver()`. In practice, Task 5 special-cases `key === "in_app"` to collect rows for a batched insert, matching current behavior. Justification: the hard acceptance contract is "existing tests pass unchanged" — a per-row insert changes the SQL pattern and risks integration test drift on shared transactions. A follow-up bead (not required for this PR) can split `deliverBatch()` vs. `deliver()` on the interface if we want every channel symmetric. **Decision: ship the asymmetry, document it here.**

2. **`NotificationType` exported from two places (shim re-export + direct).** `~/lib/notifications` (shim) and `~/lib/notifications/dispatch` (source) both export `NotificationType`. Callers use the shim. `notification-formatting.ts` uses the direct path only to avoid the circular dependency. This is standard TypeScript practice and not a real deviation, but worth flagging.

3. **No behavior flag.** Spec confirms this. Ship on main in one PR.

## Open questions (for reviewer)

1. **Should `shouldDeliver` receive `ctx` instead of just `prefs, type`?** PR 4 (Discord) needs to check `discord_user_id` presence on the user profile — which is not a preference. Options: (a) extend `NotificationPreferencesRow` with denormalized profile fields, (b) pass a wider `ShouldDeliverContext { prefs, profile, type }`, (c) keep `shouldDeliver` pure on prefs and handle "no Discord ID" inside `deliver()`. Option (c) is simpler but makes the `NotificationChannel` contract leak "skipped" results into `DeliveryResult`. **My recommendation: defer to PR 4's plan.** The contract in Task 1 can evolve without breaking email/in-app.

2. **Should `emailChannel.deliver` use the channel's own logger or `log` from `~/lib/logger`?** Current dispatcher uses `~/lib/logger`. Channels inherit the same import. No change needed, but if PR 4 wants per-channel log scoping, it becomes relevant.

3. **Does `machine_ownership_changed` bypassing granular prefs actually fit the channel model?** It's a cross-channel "always deliver" rule currently hardcoded in the switch. Today both channels unconditionally return true for that type — it works. If future events have similar overrides, consider a top-level "force events" set in `dispatch.ts` that skips the channel predicate entirely. Not needed for this PR.

## Self-review checklist (run before handoff)

- [x] Every spec requirement maps to a task:
  - Channel contract → Task 1
  - Separate files per channel → Task 4
  - `getChannels()` as a function → Task 4 (registry.ts)
  - `Promise.allSettled` dispatch preserved → Task 5 step 1
  - Synchronous/inline delivery preserved → Task 5 (no queue introduced)
  - All existing tests pass unchanged → Task 5 step 4, Task 6
  - Discord stub scaffolded but not functional → Task 4 step 3
  - No Discord delivery code → Task 4's `discord-channel.ts` throws if invoked
  - No email formatting consolidation → Task 4 imports `getEmailHtml/getEmailSubject` unchanged; follow-up bead PP-gk6 tracks it.
- [x] No placeholder text ("TBD", "implement later", "handle edge cases").
- [x] Types consistent across tasks:
  - `NotificationChannel` defined in Task 1, used in Tasks 3/4.
  - `ChannelContext` defined in Task 1, constructed in Task 5.
  - `NotificationPreferencesRow` exported from `types.ts`, imported by tests + channels.
  - `DeliveryResult` defined in Task 1, returned by every `deliver()`.
- [x] Every code step shows the actual code.
- [x] Every test step shows the actual assertion.
- [x] Every commit step shows the actual files and message.
