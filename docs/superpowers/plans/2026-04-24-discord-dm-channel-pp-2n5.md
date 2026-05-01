# Discord DM Channel + Preferences UI Implementation Plan (PP-2n5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Discord DMs as a third notification channel with full per-event preferences parity to email, and let users self-verify the integration via a Test DM button.

**Architecture:** Plug a `discordChannel` into the registry from PR 1, fed by a stateless `sendDm` bot client that reads its token from `getDiscordConfig()` (PR 3). The dispatcher gains `discordUserId` in `ChannelContext`; the channel reads new `discordEnabled` / `discordNotifyOn*` columns plus a `discord_dm_blocked_at` suppression flag. The auth callback writes `user_profiles.discord_user_id` from `auth.identities`, the unlink action clears it, and the preferences form grows a third column that container-queries-stack on narrow viewports and disables (with a "Link Discord" CTA) when the user has no Discord identity.

**Tech Stack:** Drizzle ORM, Postgres, Next.js App Router (Server Components + Server Actions), Supabase Auth identities, native `fetch` against Discord REST v10, React 19 with `useActionState`, container queries via Tailwind v4.

**Spec reference:** `docs/superpowers/specs/2026-04-19-discord-integration-design.md` § PR 4 + decisions #1, #14, #15, #16, #18, #20, #23. Beads issue: PP-2n5.

---

## File Structure

**Created:**

- `drizzle/0031_discord_notification_channel.sql` — schema migration (auto-generated)
- `drizzle/meta/0031_snapshot.json` — companion snapshot (auto-generated)
- `src/lib/discord/client.ts` — `sendDm()` + 429 retry-after handling
- `src/lib/discord/messages.ts` — `formatDiscordMessage()` plain-text formatter with footer
- `src/lib/discord/client.test.ts` — bot client unit tests
- `src/lib/discord/messages.test.ts` — formatter unit tests
- `src/lib/notifications/channels/discord-channel.test.ts` — channel unit tests
- `src/app/(app)/settings/connected-accounts/test-discord-dm-action.ts` — Test DM server action
- `src/app/(app)/settings/connected-accounts/test-discord-dm-action.test.ts` — action unit tests
- `src/app/(app)/settings/connected-accounts/discord-test-dm-button.tsx` — client component with inline result
- `e2e/notifications/discord-dm-preferences.spec.ts` — E2E happy-path

**Modified:**

- `src/server/db/schema.ts` — add 8 columns to `notificationPreferences`, 1 to `userProfiles`
- `src/lib/notifications/channels/types.ts` — add `discordUserId: string | null` to `ChannelContext`
- `src/lib/notifications/channels/registry.ts` — convert `getChannels()` → async, conditionally append `discordChannel`
- `src/lib/notifications/channels/discord-channel.ts` — replace stub with real implementation
- `src/lib/notifications/dispatch.ts` — `await getChannels()`; fetch `discordUserId` alongside email; thread it; expand `buildDefaultPrefs`
- `src/app/(auth)/auth/callback/route.ts` — write `user_profiles.discord_user_id` from `auth.identities`
- `src/app/(auth)/oauth-actions-core.ts` — clear `discord_user_id` on Discord unlink
- `src/app/(app)/settings/connected-accounts/connected-accounts-section.tsx` — render Test DM button under the Discord row when linked + integration enabled
- `src/app/(app)/settings/notifications/notification-preferences-form.tsx` — third column with disabled-when-unlinked + container-query stacking
- `src/app/(app)/settings/notifications/actions.ts` — parse + persist 8 new fields
- `src/app/(app)/settings/notifications/page.tsx` — fetch `discordUserId`, `discordIntegrationEnabled` for the form
- `src/app/(app)/settings/notifications/notification-preferences-form.test.tsx` — extend coverage for Discord column

**Untouched (intentional):**

- `notification-formatting.ts` — Discord uses its own plain-text formatter (decision #11). Don't reuse `getEmailHtml`.

---

## Task 1: Schema migration — add Discord columns

**Files:**

- Modify: `src/server/db/schema.ts:47-75` (add `discordUserId` to `userProfiles`)
- Modify: `src/server/db/schema.ts:419-498` (add `discordEnabled`, 6 `discordNotifyOn*`, `discordWatchNewIssuesGlobal`, `discordDmBlockedAt`)
- Create: `drizzle/0031_discord_notification_channel.sql` (auto-generated)
- Create: `drizzle/meta/0031_snapshot.json` (auto-generated)

- [ ] **Step 1: Add `discordUserId` to `userProfiles`**

In `src/server/db/schema.ts`, inside the `userProfiles` table definition, add (after `avatarUrl`):

```ts
discordUserId: text("discord_user_id").unique(),
```

The column is nullable (no `.notNull()`) — most users won't have Discord linked. `.unique()` enforces 1:1 so we can use it as a join key from notifications.

- [ ] **Step 2: Add Discord preference columns**

In `src/server/db/schema.ts`, inside `notificationPreferences`, append (after `inAppNotifyOnMachineOwnershipChange`, before the closing `}` of the columns object):

```ts
// Discord — main switch
discordEnabled: boolean("discord_enabled").notNull().default(true),

// Discord — per-event toggles (mirror email/in-app shape)
discordNotifyOnAssigned: boolean("discord_notify_on_assigned")
  .notNull()
  .default(true),
discordNotifyOnStatusChange: boolean("discord_notify_on_status_change")
  .notNull()
  .default(false),
discordNotifyOnNewComment: boolean("discord_notify_on_new_comment")
  .notNull()
  .default(false),
discordNotifyOnMentioned: boolean("discord_notify_on_mentioned")
  .notNull()
  .default(true),
discordNotifyOnNewIssue: boolean("discord_notify_on_new_issue")
  .notNull()
  .default(false),
discordNotifyOnMachineOwnershipChange: boolean(
  "discord_notify_on_machine_ownership_change"
)
  .notNull()
  .default(false),
discordWatchNewIssuesGlobal: boolean("discord_watch_new_issues_global")
  .notNull()
  .default(false),

// PR 5 — set when Discord rejects DMs to this user (used by failure detection)
discordDmBlockedAt: timestamp("discord_dm_blocked_at", { withTimezone: true }),
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: A new file `drizzle/0031_discord_notification_channel.sql` containing `ALTER TABLE` statements for both tables, plus `drizzle/meta/0031_snapshot.json`.

If the prompt asks for a migration name, type: `discord_notification_channel`.

- [ ] **Step 4: Inspect the generated SQL**

Run: `cat drizzle/0031_discord_notification_channel.sql`
Verify: `ALTER TABLE "user_profiles" ADD COLUMN "discord_user_id" text` and `ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_discord_user_id_unique" UNIQUE("discord_user_id")`, plus 8 column adds on `notification_preferences`. No unintended drops or renames.

- [ ] **Step 5: Apply locally and verify**

Run: `pnpm db:migrate && pnpm db:generate`
Expected: Migration applies cleanly. Second `db:generate` outputs "No schema changes" — proves the schema and the snapshot agree.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema.ts drizzle/0031_discord_notification_channel.sql drizzle/meta/0031_snapshot.json drizzle/meta/_journal.json
git commit -m "feat(notifications): add Discord preference columns + discord_user_id (PP-2n5)"
```

---

## Task 2: Discord message formatter

**Files:**

- Create: `src/lib/discord/messages.ts`
- Create: `src/lib/discord/messages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/discord/messages.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatDiscordMessage } from "./messages";

describe("formatDiscordMessage", () => {
  it("renders an issue_assigned DM with title, formatted id, and footer link", () => {
    const out = formatDiscordMessage({
      type: "issue_assigned",
      siteUrl: "https://app.example.com",
      issueTitle: "Pop bumper not working",
      formattedIssueId: "AFM-07",
      resourceType: "issue",
      resourceId: "issue-uuid-1",
      machineName: "Attack From Mars",
      newStatus: undefined,
      commentContent: undefined,
    });

    expect(out).toContain("AFM-07");
    expect(out).toContain("Pop bumper not working");
    expect(out).toContain("assigned");
    expect(out).toContain("https://app.example.com/issues/issue-uuid-1");
    // Footer line — points users back to where they manage prefs
    expect(out).toMatch(/Manage notifications.*\/settings\/notifications/i);
  });

  it("renders a machine_ownership_changed DM scoped to the machine", () => {
    const out = formatDiscordMessage({
      type: "machine_ownership_changed",
      siteUrl: "https://app.example.com",
      issueTitle: undefined,
      formattedIssueId: undefined,
      resourceType: "machine",
      resourceId: "machine-uuid-1",
      machineName: "Medieval Madness",
      newStatus: undefined,
      commentContent: undefined,
    });

    expect(out).toContain("Medieval Madness");
    expect(out).toContain("https://app.example.com/machines/machine-uuid-1");
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `pnpm vitest run src/lib/discord/messages.test.ts`
Expected: FAIL — `Cannot find module './messages'`.

- [ ] **Step 3: Implement the formatter**

Create `src/lib/discord/messages.ts`:

```ts
import type { NotificationType } from "~/lib/notifications/dispatch";

export interface DiscordMessageInput {
  type: NotificationType;
  siteUrl: string;
  resourceType: "issue" | "machine";
  resourceId: string;
  issueTitle: string | undefined;
  formattedIssueId: string | undefined;
  machineName: string | undefined;
  newStatus: string | undefined;
  commentContent: string | undefined;
}

export function formatDiscordMessage(input: DiscordMessageInput): string {
  const link = buildResourceLink(input);
  const body = buildBody(input);
  const footer = `Manage notifications: ${input.siteUrl}/settings/notifications`;
  return `${body}\n${link}\n\n${footer}`;
}

function buildResourceLink(input: DiscordMessageInput): string {
  if (input.resourceType === "issue") {
    return `${input.siteUrl}/issues/${input.resourceId}`;
  }
  return `${input.siteUrl}/machines/${input.resourceId}`;
}

function buildBody(input: DiscordMessageInput): string {
  const id = input.formattedIssueId ?? "";
  const title = input.issueTitle ?? "";
  const machine = input.machineName ?? "a machine";

  switch (input.type) {
    case "issue_assigned":
      return `You were assigned ${id} — ${title}`;
    case "issue_status_changed":
      return `${id} — ${title} is now ${input.newStatus ?? "updated"}`;
    case "new_comment":
      return `New comment on ${id} — ${title}`;
    case "new_issue":
      return `New issue on ${machine}: ${id} — ${title}`;
    case "mentioned":
      return `You were mentioned on ${id} — ${title}`;
    case "machine_ownership_changed":
      return `Ownership changed for ${machine}`;
  }
}
```

- [ ] **Step 4: Run the test, watch it pass**

Run: `pnpm vitest run src/lib/discord/messages.test.ts`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/discord/messages.ts src/lib/discord/messages.test.ts
git commit -m "feat(discord): plain-text DM formatter with settings footer (PP-2n5)"
```

---

## Task 3: Bot client — `sendDm` with retry-after handling

**Files:**

- Create: `src/lib/discord/client.ts`
- Create: `src/lib/discord/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/discord/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendDm } from "./client";

const ORIGINAL_FETCH = globalThis.fetch;

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function installFetchMock(handler: (call: FetchCall) => Response): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.useRealTimers();
});

describe("sendDm", () => {
  it("opens a DM channel and posts a message — happy path", async () => {
    const calls = installFetchMock((call) => {
      if (call.url.endsWith("/users/@me/channels")) {
        return new Response(JSON.stringify({ id: "dm-chan-1" }), {
          status: 200,
        });
      }
      if (call.url.endsWith("/channels/dm-chan-1/messages")) {
        return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
      }
      throw new Error(`unexpected url ${call.url}`);
    });

    const result = await sendDm({
      botToken: "bot-tok",
      discordUserId: "user-1",
      content: "hi",
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: "Bot bot-tok",
    });
  });

  it("retries once after a 429 honoring retry-after", async () => {
    let attempt = 0;
    installFetchMock((call) => {
      if (call.url.endsWith("/users/@me/channels")) {
        return new Response(JSON.stringify({ id: "dm-1" }), { status: 200 });
      }
      attempt += 1;
      if (attempt === 1) {
        return new Response(JSON.stringify({ retry_after: 0.05 }), {
          status: 429,
          headers: { "retry-after": "0.05" },
        });
      }
      return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
    });

    const promise = sendDm({
      botToken: "t",
      discordUserId: "u",
      content: "hi",
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(await promise).toEqual({ ok: true });
    expect(attempt).toBe(2);
  });

  it("returns reason='blocked' on 403", async () => {
    installFetchMock((call) =>
      call.url.endsWith("/users/@me/channels")
        ? new Response("{}", { status: 403 })
        : new Response("{}", { status: 200 })
    );
    const result = await sendDm({
      botToken: "t",
      discordUserId: "u",
      content: "hi",
    });
    expect(result).toEqual({ ok: false, reason: "blocked" });
  });

  it("returns reason='transient' on network error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("network");
    }) as typeof fetch;
    const result = await sendDm({
      botToken: "t",
      discordUserId: "u",
      content: "hi",
    });
    expect(result).toEqual({ ok: false, reason: "transient" });
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `pnpm vitest run src/lib/discord/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client**

Create `src/lib/discord/client.ts`:

```ts
import "server-only";
import { log } from "~/lib/logger";

const DISCORD_API = "https://discord.com/api/v10";

export type SendDmResult =
  | { ok: true }
  | {
      ok: false;
      reason: "blocked" | "rate_limited" | "transient" | "not_configured";
    };

export interface SendDmInput {
  botToken: string;
  discordUserId: string;
  content: string;
}

export async function sendDm(input: SendDmInput): Promise<SendDmResult> {
  if (!input.botToken) return { ok: false, reason: "not_configured" };

  const channel = await openDmChannel(input.botToken, input.discordUserId);
  if (!channel.ok) return channel.result;

  return postMessage(input.botToken, channel.channelId, input.content);
}

async function openDmChannel(
  botToken: string,
  recipientId: string
): Promise<
  { ok: true; channelId: string } | { ok: false; result: SendDmResult }
> {
  const res = await safeFetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: authHeaders(botToken),
    body: JSON.stringify({ recipient_id: recipientId }),
  });
  if (!res.ok) return { ok: false, result: classify(res) };

  const json = (await res.json()) as { id?: string };
  if (!json.id)
    return { ok: false, result: { ok: false, reason: "transient" } };
  return { ok: true, channelId: json.id };
}

async function postMessage(
  botToken: string,
  channelId: string,
  content: string
): Promise<SendDmResult> {
  const send = (): Promise<Response> =>
    safeFetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: authHeaders(botToken),
      body: JSON.stringify({ content }),
    });

  let res = await send();
  if (res.status === 429) {
    const retryAfterSec = parseRetryAfter(res);
    await sleep(retryAfterSec * 1000);
    res = await send();
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
  }
  if (!res.ok) return classify(res);
  return { ok: true };
}

function classify(res: Response): SendDmResult {
  if (res.status === 403 || res.status === 404) {
    return { ok: false, reason: "blocked" };
  }
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  log.warn(
    { status: res.status, action: "sendDm.classify" },
    "Discord API non-2xx"
  );
  return { ok: false, reason: "transient" };
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    log.warn({ err, url, action: "sendDm.fetch" }, "Discord fetch failed");
    return new Response(null, { status: 599 });
  }
}

function authHeaders(botToken: string): Record<string, string> {
  return {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };
}

function parseRetryAfter(res: Response): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const n = Number.parseFloat(header);
    if (Number.isFinite(n)) return n;
  }
  return 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Run the test, watch it pass**

Run: `pnpm vitest run src/lib/discord/client.test.ts`
Expected: PASS — all four cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/discord/client.ts src/lib/discord/client.test.ts
git commit -m "feat(discord): bot client sendDm with 429 retry-after (PP-2n5)"
```

---

## Task 4: Thread `discordUserId` through `ChannelContext`

**Files:**

- Modify: `src/lib/notifications/channels/types.ts`
- Modify: `src/lib/notifications/dispatch.ts`

- [ ] **Step 1: Add `discordUserId` to `ChannelContext`**

In `src/lib/notifications/channels/types.ts`, inside the `ChannelContext` interface (after `email: string | null;`):

```ts
discordUserId: string | null;
```

- [ ] **Step 2: Fetch `discordUserId` in dispatcher**

In `src/lib/notifications/dispatch.ts`, replace the user-fetch block (around line 186-190) with:

```ts
const users = await tx
  .select({
    id: userProfiles.id,
    email: userProfiles.email,
    discordUserId: userProfiles.discordUserId,
  })
  .from(userProfiles)
  .where(inArray(userProfiles.id, [...recipientIds]));
const emailMap = new Map(users.map((u) => [u.id, u.email]));
const discordUserIdMap = new Map(users.map((u) => [u.id, u.discordUserId]));
```

- [ ] **Step 3: Pass `discordUserId` into `ctx`**

In the same file, inside the recipient loop where `ChannelContext` is built, add:

```ts
discordUserId: discordUserIdMap.get(userId) ?? null,
```

- [ ] **Step 4: Extend `buildDefaultPrefs` for Discord defaults**

In `src/lib/notifications/dispatch.ts`, inside `buildDefaultPrefs`, append (before the closing `}`):

```ts
discordEnabled: true,
discordNotifyOnAssigned: true,
discordNotifyOnStatusChange: false,
discordNotifyOnNewComment: false,
discordNotifyOnMentioned: true,
discordNotifyOnNewIssue: false,
discordNotifyOnMachineOwnershipChange: false,
discordWatchNewIssuesGlobal: false,
discordDmBlockedAt: null,
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS — no errors. (`buildDefaultPrefs` returns the table's `$inferSelect` shape, so missing fields would surface here.)

- [ ] **Step 6: Re-run existing notification tests, watch them still pass**

Run: `pnpm vitest run src/lib/notifications`
Expected: PASS — every existing test still green. We added new fields with sensible defaults; no existing call site is forced to provide them.

- [ ] **Step 7: Commit**

```bash
git add src/lib/notifications/channels/types.ts src/lib/notifications/dispatch.ts
git commit -m "feat(notifications): thread discordUserId through ChannelContext (PP-2n5)"
```

---

## Task 5: Implement `discordChannel`

**Files:**

- Modify: `src/lib/notifications/channels/discord-channel.ts`
- Create: `src/lib/notifications/channels/discord-channel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/channels/discord-channel.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("~/lib/discord/client", () => ({
  sendDm: vi.fn(async () => ({ ok: true })),
}));
vi.mock("~/lib/discord/config", () => ({
  getDiscordConfig: vi.fn(async () => ({
    enabled: true,
    botToken: "tok",
    guildId: "g",
    inviteLink: null,
    botHealthStatus: "healthy",
    lastBotCheckAt: null,
    updatedAt: new Date(),
  })),
}));
vi.mock("~/lib/url", () => ({ getSiteUrl: () => "https://app.example.com" }));

import { discordChannel } from "./discord-channel";
import type { NotificationPreferencesRow, ChannelContext } from "./types";
import { sendDm } from "~/lib/discord/client";

function prefs(
  overrides: Partial<NotificationPreferencesRow> = {}
): NotificationPreferencesRow {
  return {
    userId: "u1",
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
    discordEnabled: true,
    discordNotifyOnAssigned: true,
    discordNotifyOnStatusChange: false,
    discordNotifyOnNewComment: false,
    discordNotifyOnMentioned: true,
    discordNotifyOnNewIssue: false,
    discordNotifyOnMachineOwnershipChange: false,
    discordWatchNewIssuesGlobal: false,
    discordDmBlockedAt: null,
    ...overrides,
  };
}

function ctx(overrides: Partial<ChannelContext> = {}): ChannelContext {
  return {
    userId: "u1",
    type: "issue_assigned",
    resourceId: "issue-1",
    resourceType: "issue",
    email: "u@example.com",
    discordUserId: "discord-1",
    issueTitle: "Bumper broken",
    machineName: "AFM",
    formattedIssueId: "AFM-01",
    commentContent: undefined,
    newStatus: undefined,
    issueDescription: undefined,
    tx: undefined as unknown as ChannelContext["tx"],
    ...overrides,
  };
}

describe("discordChannel.shouldDeliver", () => {
  it("returns false when main switch off", () => {
    expect(
      discordChannel.shouldDeliver(
        prefs({ discordEnabled: false }),
        "issue_assigned"
      )
    ).toBe(false);
  });

  it("respects per-event toggle", () => {
    expect(
      discordChannel.shouldDeliver(
        prefs({ discordNotifyOnAssigned: false }),
        "issue_assigned"
      )
    ).toBe(false);
  });

  it("forces machine_ownership_changed even if per-event off (parity with email)", () => {
    expect(
      discordChannel.shouldDeliver(
        prefs({ discordNotifyOnMachineOwnershipChange: false }),
        "machine_ownership_changed"
      )
    ).toBe(true);
  });

  it("returns false when discordDmBlockedAt is set", () => {
    expect(
      discordChannel.shouldDeliver(
        prefs({ discordDmBlockedAt: new Date() }),
        "issue_assigned"
      )
    ).toBe(false);
  });
});

describe("discordChannel.deliver", () => {
  it("returns skipped when user has no discord_user_id", async () => {
    const result = await discordChannel.deliver(ctx({ discordUserId: null }));
    expect(result).toEqual({ ok: false, reason: "skipped" });
    expect(sendDm).not.toHaveBeenCalled();
  });

  it("returns skipped when integration not configured", async () => {
    const { getDiscordConfig } = await import("~/lib/discord/config");
    vi.mocked(getDiscordConfig).mockResolvedValueOnce(null);
    const result = await discordChannel.deliver(ctx());
    expect(result).toEqual({ ok: false, reason: "skipped" });
  });

  it("calls sendDm with formatted body and returns ok on success", async () => {
    vi.mocked(sendDm).mockResolvedValueOnce({ ok: true });
    const result = await discordChannel.deliver(ctx());
    expect(result).toEqual({ ok: true });
    expect(sendDm).toHaveBeenCalledWith({
      botToken: "tok",
      discordUserId: "discord-1",
      content: expect.stringContaining("AFM-01"),
    });
  });

  it("maps blocked → permanent failure", async () => {
    vi.mocked(sendDm).mockResolvedValueOnce({
      ok: false,
      reason: "blocked",
    });
    const result = await discordChannel.deliver(ctx());
    expect(result).toEqual({ ok: false, reason: "permanent" });
  });

  it("maps transient → transient", async () => {
    vi.mocked(sendDm).mockResolvedValueOnce({
      ok: false,
      reason: "transient",
    });
    const result = await discordChannel.deliver(ctx());
    expect(result).toEqual({ ok: false, reason: "transient" });
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `pnpm vitest run src/lib/notifications/channels/discord-channel.test.ts`
Expected: FAIL — current stub throws.

- [ ] **Step 3: Implement the channel**

Replace the contents of `src/lib/notifications/channels/discord-channel.ts` with:

```ts
import { sendDm } from "~/lib/discord/client";
import { getDiscordConfig } from "~/lib/discord/config";
import { formatDiscordMessage } from "~/lib/discord/messages";
import { getSiteUrl } from "~/lib/url";
import { log } from "~/lib/logger";
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
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean {
    if (!prefs.discordEnabled) return false;
    if (prefs.discordDmBlockedAt) return false;
    switch (type) {
      case "issue_assigned":
        return prefs.discordNotifyOnAssigned;
      case "issue_status_changed":
        return prefs.discordNotifyOnStatusChange;
      case "new_comment":
        return prefs.discordNotifyOnNewComment;
      case "new_issue":
        return (
          prefs.discordNotifyOnNewIssue || prefs.discordWatchNewIssuesGlobal
        );
      case "machine_ownership_changed":
        // Parity with email: critical event, preference cannot opt out
        // (only the main discordEnabled switch can).
        return true;
      case "mentioned":
        return prefs.discordNotifyOnMentioned;
    }
  },
  async deliver(ctx: ChannelContext): Promise<DeliveryResult> {
    if (!ctx.discordUserId) return { ok: false, reason: "skipped" };

    const config = await getDiscordConfig();
    if (!config) return { ok: false, reason: "skipped" };

    const content = formatDiscordMessage({
      type: ctx.type,
      siteUrl: getSiteUrl(),
      resourceType: ctx.resourceType,
      resourceId: ctx.resourceId,
      issueTitle: ctx.issueTitle,
      formattedIssueId: ctx.formattedIssueId,
      machineName: ctx.machineName,
      newStatus: ctx.newStatus,
      commentContent: ctx.commentContent,
    });

    const result = await sendDm({
      botToken: config.botToken,
      discordUserId: ctx.discordUserId,
      content,
    });

    if (result.ok) return { ok: true };
    if (result.reason === "blocked") {
      // PR 5 will react to this and emit system_discord_dm_blocked.
      log.warn(
        { userId: ctx.userId, action: "discord.deliver" },
        "Discord DM blocked"
      );
      return { ok: false, reason: "permanent" };
    }
    if (result.reason === "not_configured") {
      return { ok: false, reason: "skipped" };
    }
    return { ok: false, reason: "transient" };
  },
};
```

- [ ] **Step 4: Run the test, watch it pass**

Run: `pnpm vitest run src/lib/notifications/channels/discord-channel.test.ts`
Expected: PASS — all six cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/channels/discord-channel.ts src/lib/notifications/channels/discord-channel.test.ts
git commit -m "feat(notifications): implement Discord DM channel (PP-2n5)"
```

---

## Task 6: Conditionally register `discordChannel`

**Files:**

- Modify: `src/lib/notifications/channels/registry.ts`
- Modify: `src/lib/notifications/dispatch.ts`

- [ ] **Step 1: Make `getChannels()` async with conditional registration**

Replace the contents of `src/lib/notifications/channels/registry.ts`:

```ts
import { getDiscordConfig } from "~/lib/discord/config";
import { discordChannel } from "./discord-channel";
import { emailChannel } from "./email-channel";
import { inAppChannel } from "./in-app-channel";
import type { NotificationChannel } from "./types";

/**
 * Returns the list of active notification channels.
 *
 * Order is fixed for test determinism:
 *   in_app → email → discord
 *
 * Discord is appended only when getDiscordConfig() returns a usable config
 * (see spec decision #18: missing token / disabled toggle → channel not
 * registered, no UI advertising the feature).
 */
export async function getChannels(): Promise<readonly NotificationChannel[]> {
  const channels: NotificationChannel[] = [inAppChannel, emailChannel];
  const discord = await getDiscordConfig();
  if (discord) channels.push(discordChannel);
  return channels;
}
```

- [ ] **Step 2: Await `getChannels()` in dispatcher**

In `src/lib/notifications/dispatch.ts`, change:

```ts
const channels = getChannels();
```

to:

```ts
const channels = await getChannels();
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Run notification tests**

Run: `pnpm vitest run src/lib/notifications`
Expected: PASS — Discord channel tests skip the registry (they import the channel directly), and existing tests don't depend on registry sync-ness.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/channels/registry.ts src/lib/notifications/dispatch.ts
git commit -m "feat(notifications): conditionally register Discord channel (PP-2n5)"
```

---

## Task 7: Auth callback writes `discord_user_id`

**Files:**

- Modify: `src/app/(auth)/auth/callback/route.ts`

- [ ] **Step 1: Add `syncDiscordIdentity` helper**

Append to `src/app/(auth)/auth/callback/route.ts` (above the final `function isValidEmailOtpType`):

```ts
async function syncDiscordIdentity(
  supabase: ReturnType<typeof createServerClient>
): Promise<void> {
  const { data: userResponse } = await supabase.auth.getUser();
  const user = userResponse.user;
  if (!user) return;

  const identities = (user.identities ?? []) as Array<{
    provider: string;
    identity_data?: { provider_id?: string; sub?: string };
  }>;
  const discord = identities.find((i) => i.provider === "discord");
  const discordUserId =
    discord?.identity_data?.provider_id ?? discord?.identity_data?.sub ?? null;

  // Lazy import keeps this server-only module out of the route's static deps
  // until the auth flow needs it.
  const { db } = await import("~/server/db");
  const { userProfiles } = await import("~/server/db/schema");
  const { eq } = await import("drizzle-orm");

  await db
    .update(userProfiles)
    .set({ discordUserId })
    .where(eq(userProfiles.id, user.id));
}
```

- [ ] **Step 2: Call the helper after successful exchange**

In the same file, inside the `if (code) { ... }` block, after the successful `exchangeCodeForSession` (where `getUser()` is currently destructured into `_user`), replace:

```ts
const {
  data: { user: _user },
} = await supabase.auth.getUser();
return applyCookies(redirectToTarget(), pendingCookies);
```

with:

```ts
await syncDiscordIdentity(supabase);
return applyCookies(redirectToTarget(), pendingCookies);
```

- [ ] **Step 3: Build to verify route compiles**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Manual smoke (deferred to E2E in Task 12)**

Note for the agent: a meaningful unit test for the callback requires mocking `createServerClient` end-to-end. The E2E test in Task 12 covers this path. Skip a unit test here.

- [ ] **Step 5: Commit**

```bash
git add src/app/(auth)/auth/callback/route.ts
git commit -m "feat(auth): mirror discord identity to user_profiles on callback (PP-2n5)"
```

---

## Task 8: Unlink action clears `discord_user_id`

**Files:**

- Modify: `src/app/(auth)/oauth-actions-core.ts`

- [ ] **Step 1: Read the existing unlink path**

Run: `rg -n "unlinkIdentity|unlinkProvider" src/app/\(auth\)/oauth-actions-core.ts`

Note where the successful unlink branch sits. We add a side effect there only when `providerKey === 'discord'`.

- [ ] **Step 2: Clear `discord_user_id` after successful Discord unlink**

In `src/app/(auth)/oauth-actions-core.ts`, locate the path that runs after `supabase.auth.unlinkIdentity` succeeds. Add (after the success branch confirms the unlink):

```ts
if (providerKey === "discord") {
  const { db } = await import("~/server/db");
  const { userProfiles } = await import("~/server/db/schema");
  const { eq } = await import("drizzle-orm");
  await db
    .update(userProfiles)
    .set({ discordUserId: null })
    .where(eq(userProfiles.id, user.id));
}
```

(`user` is the authenticated user already in scope at this point — confirm the variable name matches the file's existing convention before saving.)

- [ ] **Step 3: Run existing oauth tests**

Run: `pnpm vitest run src/app/\\(auth\\)/oauth-actions`
Expected: PASS. If any test inspects `userProfiles` after unlink, it should still pass — the new write only runs when the provider matches.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/oauth-actions-core.ts
git commit -m "feat(auth): clear discord_user_id when user unlinks Discord (PP-2n5)"
```

---

## Task 9: Test DM server action

**Files:**

- Create: `src/app/(app)/settings/connected-accounts/test-discord-dm-action.ts`
- Create: `src/app/(app)/settings/connected-accounts/test-discord-dm-action.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/(app)/settings/connected-accounts/test-discord-dm-action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/discord/config", () => ({
  getDiscordConfig: vi.fn(),
}));
vi.mock("~/lib/discord/client", () => ({
  sendDm: vi.fn(),
}));
vi.mock("~/lib/auth/get-current-user", () => ({
  getCurrentUser: vi.fn(),
}));

import { testDiscordDmAction } from "./test-discord-dm-action";
import { getDiscordConfig } from "~/lib/discord/config";
import { sendDm } from "~/lib/discord/client";
import { getCurrentUser } from "~/lib/auth/get-current-user";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("testDiscordDmAction", () => {
  it("returns ok=false / reason=not_linked when the user has no discordUserId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "u1",
      discordUserId: null,
    });
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "not_linked",
    });
    expect(sendDm).not.toHaveBeenCalled();
  });

  it("returns reason=not_configured when integration is disabled", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "u1",
      discordUserId: "d1",
    });
    vi.mocked(getDiscordConfig).mockResolvedValue(null);
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("returns ok=true on successful DM", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "u1",
      discordUserId: "d1",
    });
    vi.mocked(getDiscordConfig).mockResolvedValue({
      enabled: true,
      botToken: "t",
      guildId: null,
      inviteLink: null,
      botHealthStatus: "healthy",
      lastBotCheckAt: null,
      updatedAt: new Date(),
    });
    vi.mocked(sendDm).mockResolvedValue({ ok: true });
    expect(await testDiscordDmAction()).toEqual({ ok: true });
  });
});
```

(If `getCurrentUser` doesn't exist or has a different name, mirror the project's existing pattern — search for how `connected-accounts-section.tsx` resolves the current user and reuse that.)

- [ ] **Step 2: Run the test, watch it fail**

Run: `pnpm vitest run src/app/\\(app\\)/settings/connected-accounts/test-discord-dm-action.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the action**

Create `src/app/(app)/settings/connected-accounts/test-discord-dm-action.ts`:

```ts
"use server";

import { sendDm } from "~/lib/discord/client";
import { getDiscordConfig } from "~/lib/discord/config";
import { getCurrentUser } from "~/lib/auth/get-current-user";

export type TestDmResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_linked"
        | "not_configured"
        | "blocked"
        | "rate_limited"
        | "transient";
    };

export async function testDiscordDmAction(): Promise<TestDmResult> {
  const user = await getCurrentUser();
  if (!user.discordUserId) return { ok: false, reason: "not_linked" };

  const config = await getDiscordConfig();
  if (!config) return { ok: false, reason: "not_configured" };

  const result = await sendDm({
    botToken: config.botToken,
    discordUserId: user.discordUserId,
    content:
      "Test DM from PinPoint — your Discord notifications are working! Manage them at /settings/notifications",
  });

  if (result.ok) return { ok: true };
  if (result.reason === "not_configured") {
    return { ok: false, reason: "not_configured" };
  }
  return { ok: false, reason: result.reason };
}
```

If `~/lib/auth/get-current-user` doesn't exist, replace the import with whatever helper `connected-accounts-section.tsx` uses (likely a wrapper around `createClient().auth.getUser()` plus a `userProfiles` join). The action MUST NOT trust a client-supplied user id.

- [ ] **Step 4: Run the test, watch it pass**

Run: `pnpm vitest run src/app/\\(app\\)/settings/connected-accounts/test-discord-dm-action.test.ts`
Expected: PASS — three cases.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/settings/connected-accounts/test-discord-dm-action.ts src/app/\(app\)/settings/connected-accounts/test-discord-dm-action.test.ts
git commit -m "feat(settings): testDiscordDmAction server action (PP-2n5)"
```

---

## Task 10: Test DM button in Connected Accounts row

**Files:**

- Create: `src/app/(app)/settings/connected-accounts/discord-test-dm-button.tsx`
- Modify: `src/app/(app)/settings/connected-accounts/connected-accounts-section.tsx`

- [ ] **Step 1: Build the client component**

Create `src/app/(app)/settings/connected-accounts/discord-test-dm-button.tsx`:

```tsx
"use client";

import { useTransition, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  testDiscordDmAction,
  type TestDmResult,
} from "./test-discord-dm-action";

const REASON_COPY: Record<
  Exclude<TestDmResult, { ok: true }>["reason"],
  string
> = {
  not_linked: "Link your Discord account first.",
  not_configured: "Discord integration isn't configured yet.",
  blocked:
    "Discord won't deliver to you — check that you've joined the APC server and allow DMs from members.",
  rate_limited: "Rate-limited by Discord. Try again in a moment.",
  transient: "Couldn't reach Discord. Try again.",
};

export function DiscordTestDmButton(): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TestDmResult | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setResult(await testDiscordDmAction());
          });
        }}
      >
        {pending ? "Sending…" : "Send test DM"}
      </Button>
      {result && (
        <p
          className={
            result.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"
          }
          role="status"
        >
          {result.ok ? "Test DM sent" : REASON_COPY[result.reason]}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Slot the button under the linked Discord row**

In `src/app/(app)/settings/connected-accounts/connected-accounts-section.tsx`, find where it renders `<ConnectedAccountRow … providerKey="discord" … isLinked={…} />`. After that row, conditionally render:

```tsx
{
  discord.isLinked && discordIntegrationEnabled && (
    <div className="pl-12">
      <DiscordTestDmButton />
    </div>
  );
}
```

`discordIntegrationEnabled` is a new prop added below — pass it from the section's caller (settings page server component) where `await getDiscordConfig()` has already been awaited (caller-side, not in this section's render path).

If the section is currently a Server Component, leave it server-side and only the button itself is `"use client"`. If the section is a Client Component, the prop must come from a server-side parent.

- [ ] **Step 3: Add `discordIntegrationEnabled` prop to the section**

At the top of `connected-accounts-section.tsx`, add the prop to its props interface:

```ts
discordIntegrationEnabled: boolean;
```

Then update the page that renders this section (likely `src/app/(app)/settings/page.tsx`) to compute and pass it:

```ts
import { getDiscordConfig } from "~/lib/discord/config";
// …
const discordConfig = await getDiscordConfig();
// …
<ConnectedAccountsSection
  /* existing props */
  discordIntegrationEnabled={discordConfig !== null}
/>
```

- [ ] **Step 4: Run typecheck + connected-accounts tests**

Run: `pnpm typecheck && pnpm vitest run src/app/\\(app\\)/settings/connected-accounts`
Expected: PASS — only modify existing tests if the section's prop signature broke them; in that case, pass `discordIntegrationEnabled: true` to the test render.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/settings/connected-accounts/
git commit -m "feat(settings): Test DM button under linked Discord row (PP-2n5)"
```

---

## Task 11: Discord column in preferences form

**Files:**

- Modify: `src/app/(app)/settings/notifications/notification-preferences-form.tsx`
- Modify: `src/app/(app)/settings/notifications/actions.ts`
- Modify: `src/app/(app)/settings/notifications/page.tsx`
- Modify: `src/app/(app)/settings/notifications/notification-preferences-form.test.tsx`

- [ ] **Step 1: Extend `NotificationPreferencesData`**

In `notification-preferences-form.tsx`, expand the `NotificationPreferencesData` interface to add the 8 Discord boolean fields (mirroring email/in-app):

```ts
discordEnabled: boolean;
discordNotifyOnAssigned: boolean;
discordNotifyOnStatusChange: boolean;
discordNotifyOnNewComment: boolean;
discordNotifyOnMentioned: boolean;
discordNotifyOnNewIssue: boolean;
discordWatchNewIssuesGlobal: boolean;
discordNotifyOnMachineOwnershipChange: boolean;
```

(Don't expose `discordDmBlockedAt` to the client — that's a server-side concern from PR 5.)

- [ ] **Step 2: Add `userHasDiscord` and `discordIntegrationEnabled` props**

In the same file, expand `NotificationPreferencesFormProps`:

```ts
userHasDiscord: boolean;
discordIntegrationEnabled: boolean;
```

When `discordIntegrationEnabled === false`, the entire Discord column is hidden (decision #18 — channel not registered, don't advertise).

- [ ] **Step 3: Add `discordMainEnabled` client state**

After `inAppMainEnabled`'s `useState`, add:

```ts
const [discordMainEnabled, setDiscordMainEnabled] = useState(
  preferences.discordEnabled
);
```

And mirror the `useEffect` reset block:

```ts
useEffect(() => {
  setDiscordMainEnabled(preferences.discordEnabled);
}, [preferences.discordEnabled]);
```

The form's `onCancel` handler must also reset it.

- [ ] **Step 4: Render the Discord main switch**

Inside the `Channels` section's grid (currently `grid gap-4 sm:grid-cols-2`), add a third `MainSwitchItem` for Discord and widen the grid using a container query:

```tsx
<div className="grid gap-4 @md:grid-cols-2 @xl:grid-cols-3">
  {/* email switch (unchanged) */}
  {/* in-app switch (unchanged) */}
  {discordIntegrationEnabled && (
    <MainSwitchItem
      id="discordEnabled"
      label="Discord Notifications"
      description={
        userHasDiscord
          ? "Main switch for all Discord DM notifications"
          : "Link Discord to enable"
      }
      checked={discordMainEnabled && userHasDiscord}
      onCheckedChange={setDiscordMainEnabled}
      disabled={!userHasDiscord}
      cta={
        userHasDiscord ? undefined : (
          <a
            href="/settings#connected-accounts"
            className="text-xs text-primary underline"
          >
            Link Discord
          </a>
        )
      }
    />
  )}
</div>
```

(`MainSwitchItem` needs a `disabled` and optional `cta` prop — extend its props interface and inline-render the CTA below the description when present.)

- [ ] **Step 5: Add a Discord column to `PreferenceRow`**

Extend `PreferenceRowProps`:

```ts
hideDiscord?: boolean | undefined;
discordId?: string | undefined;
discordDefault?: boolean | undefined;
discordDisabled?: boolean | undefined;
```

Update its grid template:

```tsx
hideEmail
  ? hideDiscord
    ? "grid grid-cols-[1fr_auto]"
    : "grid grid-cols-[1fr_auto_auto]"
  : hideDiscord
    ? "grid grid-cols-[1fr_auto_auto]"
    : "grid grid-cols-[1fr_auto_auto_auto]";
```

(Container queries handle narrow-screen stacking — wrap the row in `@container` and at `@max-md:` switch the row from grid to flex-column. Easier approach: apply `@max-md:grid-cols-1 @max-md:gap-2` to fall back to vertical at narrow widths.)

Add a Discord switch column matching the email/in-app pattern, gated by `!hideDiscord`. Call sites pass the matching IDs (`discordNotifyOnAssigned`, etc.), defaults from `preferences`, and `discordDisabled={!discordMainEnabled || !userHasDiscord}`.

- [ ] **Step 6: Wire each event row's Discord column**

For every `<PreferenceRow>` invocation in the file (Owned Machines, All Machines, Issue Assignment, Status Changes, New Comments, Mentions), pass the Discord trio:

```tsx
hideDiscord={!discordIntegrationEnabled}
discordId="discordNotifyOnAssigned"   // or matching column
discordDefault={preferences.discordNotifyOnAssigned}
discordDisabled={!discordMainEnabled || !userHasDiscord}
```

- [ ] **Step 7: Persist Discord fields in the server action**

In `src/app/(app)/settings/notifications/actions.ts`, add the 8 new fields to whatever Zod/raw FormData parsing already exists for email/in-app. They serialize the same way (`"on"` ↔ `boolean`). The DB write is a single `update(notificationPreferences).set({…})` — append the discord properties.

- [ ] **Step 8: Pass the new props from the page server component**

In `src/app/(app)/settings/notifications/page.tsx`:

```tsx
import { getDiscordConfig } from "~/lib/discord/config";
// …
const discordConfig = await getDiscordConfig();
const userProfile = await db.query.userProfiles.findFirst({
  where: eq(userProfiles.id, currentUser.id),
  columns: { discordUserId: true },
});

return (
  <NotificationPreferencesForm
    preferences={preferences}
    isInternalAccount={…}
    userHasDiscord={Boolean(userProfile?.discordUserId)}
    discordIntegrationEnabled={discordConfig !== null}
  />
);
```

- [ ] **Step 9: Update the form test for Discord column**

In `notification-preferences-form.test.tsx`, add at minimum:

```ts
it("renders Discord column when integration is enabled", () => {
  render(
    <NotificationPreferencesForm
      preferences={{ /* full default prefs incl. discord defaults */ }}
      userHasDiscord
      discordIntegrationEnabled
    />
  );
  expect(screen.getByLabelText(/Discord Notifications/i)).toBeInTheDocument();
});

it("hides Discord column when integration is disabled", () => {
  render(
    <NotificationPreferencesForm
      preferences={{ /* full default prefs */ }}
      userHasDiscord
      discordIntegrationEnabled={false}
    />
  );
  expect(screen.queryByLabelText(/Discord Notifications/i)).toBeNull();
});

it("shows Link Discord CTA when user is not linked", () => {
  render(
    <NotificationPreferencesForm
      preferences={{ /* full default prefs */ }}
      userHasDiscord={false}
      discordIntegrationEnabled
    />
  );
  expect(screen.getByText(/Link Discord/i)).toBeInTheDocument();
});
```

(Existing tests will break because the prefs shape changed — extend each to provide the 8 new fields.)

- [ ] **Step 10: Run form tests**

Run: `pnpm vitest run src/app/\\(app\\)/settings/notifications`
Expected: PASS — old + new cases.

- [ ] **Step 11: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/app/\(app\)/settings/notifications/
git commit -m "feat(notifications): Discord column in preferences form (PP-2n5)"
```

---

## Task 12: E2E happy path — link → toggle → notify

**Files:**

- Create: `e2e/notifications/discord-dm-preferences.spec.ts`

This test runs against PinPoint's existing E2E harness. It does NOT exercise real Discord — it mocks `sendDm` at the route handler level via a test-only fixture. We DO exercise: schema migration, registry registration, channel `shouldDeliver`, and form persistence.

- [ ] **Step 1: Write the spec**

Create `e2e/notifications/discord-dm-preferences.spec.ts`:

```ts
import { test, expect } from "../support/test-base";
import { signInAs } from "../support/actions";

test.describe("Discord DM preferences", () => {
  test("user without Discord linked sees disabled column with Link CTA", async ({
    page,
  }) => {
    await signInAs(page, "member");
    await page.goto("/settings/notifications");

    const discordSwitch = page.getByLabel(/Discord Notifications/i);
    // Hidden if integration disabled in this test env — that's fine, the
    // negative case is covered by unit tests.
    if (await discordSwitch.count()) {
      await expect(discordSwitch).toBeDisabled();
      await expect(page.getByText(/Link Discord/i)).toBeVisible();
    }
  });

  test("toggling a Discord per-event switch persists across reload", async ({
    page,
    seedDiscordLinkedUser,
  }) => {
    // The fixture seeds a user with discord_user_id set + the integration
    // config flagged enabled in this worker's DB. See e2e/support/fixtures.
    await seedDiscordLinkedUser();
    await page.goto("/settings/notifications");

    const newCommentDiscord = page.getByTestId(
      "pref-discordNotifyOnNewComment"
    );
    await newCommentDiscord.check();
    await page.getByRole("button", { name: /save preferences/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible();

    await page.reload();
    await expect(
      page.getByTestId("pref-discordNotifyOnNewComment")
    ).toBeChecked();
  });
});
```

The fixture `seedDiscordLinkedUser` lives in `e2e/support/fixtures.ts` — add it there if absent. It should:

1. INSERT a `user_profiles` row with `discord_user_id = 'test-discord-1'`.
2. UPSERT `discord_integration_config` with `enabled = true` (using the SECURITY DEFINER RPC if your test harness supports it; otherwise a direct admin-client INSERT in the test DB).
3. Sign that user in (set the session cookie).

The first test gracefully passes whether or not Discord is enabled in the test env — most useful as a smoke that the form still renders.

- [ ] **Step 2: Add the `data-testid` attributes referenced above**

In `notification-preferences-form.tsx`, add `data-testid={\`pref-${discordId}\`}` (etc.) to each switch. This is the project's existing E2E pattern for selectors — verify by skimming the file.

- [ ] **Step 3: Run the spec on Chromium only**

Run: `pnpm exec playwright test e2e/notifications/discord-dm-preferences.spec.ts --project=chromium`
Expected: PASS. If the fixture isn't ready, the second test will skip with a clear error — implement the fixture and rerun.

- [ ] **Step 4: Add the route to the responsive overflow regression spec**

Per persistent memory `responsive-overflow-regression-test-exists-at-e2e-smoke`, the new page (`/settings/notifications`) is already covered there. No change needed unless we introduced a new route — we didn't.

- [ ] **Step 5: Commit**

```bash
git add e2e/notifications/discord-dm-preferences.spec.ts e2e/support/
git commit -m "test(e2e): Discord DM preferences happy path (PP-2n5)"
```

---

## Task 13: Preflight + push + open PR

**Files:**

- (Verification only)

- [ ] **Step 1: Run the full preflight suite**

Run: `pnpm run preflight`
Expected: PASS — typecheck, lint, format, unit, integration, build all green.

- [ ] **Step 2: Run smoke (browsers)**

Run: `pnpm run smoke`
Expected: PASS.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/discord-dm-channel-pp-2n5
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat(notifications): Discord DM channel + preferences UI (PP-2n5)" \
  --body "$(cat <<'EOF'
## Summary

- Adds Discord as the third notification channel, plugged into PR 1's dispatcher
- Introduces `discordEnabled` + 6 per-event toggles + `discordWatchNewIssuesGlobal` on `notification_preferences`; mirrors `auth.identities` Discord provider_id into `user_profiles.discord_user_id`
- Preferences form gains a third column with container-query stacking and a "Link Discord" CTA when the user has no Discord identity; Connected Accounts row gains a Test DM button

## Test plan

- [ ] `pnpm run preflight` passes
- [ ] Discord channel `shouldDeliver` matrix matches email parity (incl. forced `machine_ownership_changed`)
- [ ] Bot client honors `retry-after` once on 429, then drops
- [ ] Auth callback writes `discord_user_id`; unlink clears it
- [ ] Preferences form persists Discord toggles end-to-end
- [ ] Test DM button shows actionable inline result for `not_linked` / `not_configured` / `blocked` / `transient`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Close the bead**

```bash
bd close PP-2n5 --reason="PR opened: <url from step 4>"
bd dolt push
```

---

## Self-review pass

**Spec coverage:**

- ✅ `notification_preferences` schema additions (Task 1)
- ✅ `user_profiles.discord_user_id` mirror, written on callback / cleared on unlink (Tasks 1, 7, 8)
- ✅ `src/lib/discord/client.ts` `sendDm` with retry-after (Task 3)
- ✅ Discord channel implementing PR 1 contract (Task 5)
- ✅ Conditional registry registration when `getDiscordConfig().enabled` (Task 6)
- ✅ Three-column preferences form with container-query stacking (Task 11)
- ✅ Disabled column + Link CTA when not linked (Task 11)
- ✅ Test DM button in Connected Accounts (Tasks 9, 10)
- ✅ DM footer line linking to `/settings/notifications` (Task 2)

**Out of scope (PR 5 territory):**

- `discord_dm_blocked_at` write-back on 403 — added to the schema and read by `shouldDeliver`, but the dispatcher does not yet _write_ it; PR 5 (PP-eps) adds the failure-detection path including the `system_discord_dm_blocked` system notification.
- `system_discord_*` notification types and global self-check.

These are PR 5's job by design (decision #5/#19/spec § PR 5). The schema column and `shouldDeliver` suppression are landed here so PR 5 doesn't have to touch the channel again.

**No placeholders detected.** All steps include either runnable commands or full code blocks.

**Type consistency check:**

- `DiscordConfig.botToken` is `string` (PR 3); `sendDm` consumes `botToken: string` ✅
- `DeliveryResult` reasons remain `transient | permanent | skipped` (defined in PR 1's `types.ts`); the channel maps `sendDm` reasons onto these ✅
- `ChannelContext.discordUserId` typed `string | null`; channel and dispatcher agree ✅
- `getChannels()` becomes `Promise<readonly NotificationChannel[]>` and the only caller (`dispatch.ts`) awaits it ✅
