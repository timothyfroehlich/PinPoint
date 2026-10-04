/**
 * Integration test: the activity summary settings actions (PP-ogup,
 * discord-activity-summary spec §2, §3.8, §8).
 *
 * Real PGlite for the Discord config singleton. Mocked only at the seams that
 * leave the process: Supabase auth, the access-level lookup, the Vault token
 * accessor, the Discord channel post, and `fetch` for the channel check.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { eq } from "drizzle-orm";
import { discordIntegrationConfig } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

const ADMIN_ID = "5d9e7234-b866-4ce4-8419-d2e27d014acf";
const CHANNEL_ID = "123456789012345678";
const OTHER_CHANNEL_ID = "987654321098765432";

const {
  createClientMock,
  getUserAccessLevelMock,
  getDiscordBotTokenMock,
  postChannelMessageMock,
  discordServer,
} = vi.hoisted(() => {
  const discordServer: { id: string | null } = { id: "guild" };
  return {
    discordServer,
    createClientMock: vi.fn(),
    getUserAccessLevelMock: vi.fn(),
    getDiscordBotTokenMock: vi.fn(),
    postChannelMessageMock: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: getUserAccessLevelMock,
}));
vi.mock("~/lib/discord/config", () => ({
  getDiscordBotToken: getDiscordBotTokenMock,
  getDiscordConfig: async () => {
    // Configured only with a token AND a server ID (discord.md §2.2).
    const botToken: unknown = await getDiscordBotTokenMock();
    return typeof botToken === "string" && discordServer.id !== null
      ? { botToken, guildId: discordServer.id }
      : null;
  },
}));
vi.mock("~/lib/discord/client", () => ({
  DISCORD_MESSAGE_FLAGS: { SUPPRESS_EMBEDS: 1 << 2 },
  postChannelMessage: postChannelMessageMock,
}));
vi.mock("~/lib/observability/report-error", () => ({ reportError: vi.fn() }));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

import {
  saveActivitySummaryConfigAction,
  sendActivitySummaryNowAction,
  sendActivitySummaryTestAction,
} from "~/app/(app)/admin/integrations/discord/activity-summary-actions";

const VALID_INPUT = {
  channelId: CHANNEL_ID,
  interval: "12",
  startHour: 9,
  events: ["new_members", "issues_opened"],
};

function channelResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function readRow() {
  const db = await getTestDb();
  return db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
  });
}

describe("Activity summary settings actions", () => {
  setupTestDb();

  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: ADMIN_ID } } }),
      },
    });
    getUserAccessLevelMock.mockResolvedValue("admin");
    getDiscordBotTokenMock.mockResolvedValue("mock-bot-token");
    discordServer.id = "guild";
    postChannelMessageMock.mockResolvedValue({ ok: true });
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // A fresh Response per call: a body can be read only once.
      .mockImplementation(() =>
        Promise.resolve(
          channelResponse({ name: "updates", type: 0, permissions: "2048" })
        )
      );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("saveActivitySummaryConfigAction", () => {
    it("creates the missing singleton row and checks the new channel", async () => {
      expect(await readRow()).toBeUndefined();

      const result = await saveActivitySummaryConfigAction(VALID_INPUT);

      expect(result).toEqual({
        ok: true,
        status: "posting",
        statusDetail: null,
      });
      const row = await readRow();
      expect(row).toMatchObject({
        summaryChannelId: CHANNEL_ID,
        summaryIntervalHours: 12,
        summaryStartHour: 9,
        // Catalog order, whatever order the form sent.
        summaryEvents: ["issues_opened", "new_members"],
        summaryStatus: "posting",
        updatedBy: ADMIN_ID,
      });
      // The credential columns are untouched (spec §2.5).
      expect(row?.botTokenVaultId).toBeNull();
      expect(row?.guildId).toBeNull();
      expect(fetchSpy).toHaveBeenCalledWith(
        `https://discord.com/api/v10/channels/${CHANNEL_ID}`,
        expect.anything()
      );
    });

    it("stores Disabled as a NULL interval and keeps the channel", async () => {
      await saveActivitySummaryConfigAction(VALID_INPUT);

      const result = await saveActivitySummaryConfigAction({
        ...VALID_INPUT,
        interval: "disabled",
      });

      expect(result.ok).toBe(true);
      const row = await readRow();
      expect(row?.summaryIntervalHours).toBeNull();
      expect(row?.summaryChannelId).toBe(CHANNEL_ID);
    });

    it.each([
      { name: "an hour past 23", input: { ...VALID_INPUT, startHour: 24 } },
      { name: "a negative hour", input: { ...VALID_INPUT, startHour: -1 } },
      {
        name: "an unlisted interval",
        input: { ...VALID_INPUT, interval: "3" },
      },
      {
        name: "an unknown event type",
        input: { ...VALID_INPUT, events: ["issues_opened", "machine_moves"] },
      },
      {
        name: "a non-numeric channel",
        input: { ...VALID_INPUT, channelId: "general" },
      },
    ])("rejects $name without writing", async ({ input }) => {
      const result = await saveActivitySummaryConfigAction(input);

      expect(result).toMatchObject({ ok: false, reason: "invalid" });
      expect(await readRow()).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("stores Not configured for an empty channel without calling Discord", async () => {
      await saveActivitySummaryConfigAction(VALID_INPUT);
      fetchSpy.mockClear();

      const result = await saveActivitySummaryConfigAction({
        ...VALID_INPUT,
        channelId: "",
      });

      expect(result).toEqual({
        ok: true,
        status: "not_configured",
        statusDetail: null,
      });
      const row = await readRow();
      expect(row?.summaryChannelId).toBeNull();
      expect(row?.summaryStatus).toBe("not_configured");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("persists the settings when the channel check fails (CORE-ARCH-012)", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));

      const result = await saveActivitySummaryConfigAction(VALID_INPUT);

      expect(result).toEqual({
        ok: true,
        status: "cant_post",
        statusDetail: "Channel not found or bot lacks access",
      });
      const row = await readRow();
      expect(row).toMatchObject({
        summaryChannelId: CHANNEL_ID,
        summaryIntervalHours: 12,
        summaryStatus: "cant_post",
      });
    });

    it("stores Needs Discord, and the test message refuses, once the server ID is cleared (§2.4)", async () => {
      discordServer.id = null;

      const saved = await saveActivitySummaryConfigAction(VALID_INPUT);
      expect(saved).toMatchObject({ ok: true, status: "needs_discord" });
      expect((await readRow())?.summaryStatus).toBe("needs_discord");

      expect(await sendActivitySummaryTestAction(CHANNEL_ID)).toMatchObject({
        ok: false,
        reason: "needs_discord",
      });
      expect(postChannelMessageMock).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("stores Needs Discord when no bot token is saved", async () => {
      getDiscordBotTokenMock.mockResolvedValue(null);

      const result = await saveActivitySummaryConfigAction(VALID_INPUT);

      expect(result).toMatchObject({ ok: true, status: "needs_discord" });
      expect((await readRow())?.summaryStatus).toBe("needs_discord");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("re-checks an unchanged channel on every save and keeps its last post time", async () => {
      await saveActivitySummaryConfigAction(VALID_INPUT);
      await sendActivitySummaryTestAction(CHANNEL_ID);
      fetchSpy.mockClear();

      await saveActivitySummaryConfigAction({ ...VALID_INPUT, startHour: 10 });

      const row = await readRow();
      expect(row?.summaryStartHour).toBe(10);
      expect(row?.summaryStatus).toBe("posting");
      expect(row?.summaryLastPostAt).not.toBeNull();
      expect(fetchSpy).toHaveBeenCalled();
    });

    it("rejects a member without writing", async () => {
      getUserAccessLevelMock.mockResolvedValue("member");

      const result = await saveActivitySummaryConfigAction(VALID_INPUT);

      expect(result).toMatchObject({ ok: false, reason: "unauthorized" });
      expect(await readRow()).toBeUndefined();
    });
  });

  describe("sendActivitySummaryTestAction", () => {
    it("posts the test line without link previews and records it on the saved channel", async () => {
      await saveActivitySummaryConfigAction(VALID_INPUT);

      const result = await sendActivitySummaryTestAction(CHANNEL_ID);

      expect(result).toEqual({ ok: true, channelName: "updates" });
      expect(postChannelMessageMock).toHaveBeenCalledWith({
        botToken: "mock-bot-token",
        channelId: CHANNEL_ID,
        content:
          "[PinPoint] Test message: The activity summary will post to #updates.",
        flags: 1 << 2,
      });
      const row = await readRow();
      expect(row?.summaryStatus).toBe("posting");
      expect(row?.summaryStatusDetail).toBe("Test message delivered");
      expect(row?.summaryLastPostAt).toBeInstanceOf(Date);
    });

    it("leaves the saved channel's status alone when testing an unsaved channel", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));
      await saveActivitySummaryConfigAction(VALID_INPUT);
      postChannelMessageMock.mockResolvedValue({
        ok: false,
        reason: "blocked",
      });

      const result = await sendActivitySummaryTestAction(OTHER_CHANNEL_ID);

      expect(result).toMatchObject({ ok: false, reason: "cant_post" });
      const row = await readRow();
      expect(row?.summaryStatus).toBe("cant_post");
      expect(row?.summaryStatusDetail).toBe(
        "Channel not found or bot lacks access"
      );
    });

    it("moves the saved channel to Can't post when the post is refused", async () => {
      await saveActivitySummaryConfigAction(VALID_INPUT);
      postChannelMessageMock.mockResolvedValue({
        ok: false,
        reason: "blocked",
      });

      const result = await sendActivitySummaryTestAction(CHANNEL_ID);

      expect(result).toMatchObject({ ok: false, reason: "cant_post" });
      expect((await readRow())?.summaryStatus).toBe("cant_post");
    });

    it("moves the saved channel to Needs Discord when Discord rejects the token", async () => {
      await saveActivitySummaryConfigAction(VALID_INPUT);
      postChannelMessageMock.mockResolvedValue({
        ok: false,
        reason: "blocked",
        invalidToken: true,
      });

      const result = await sendActivitySummaryTestAction(CHANNEL_ID);

      expect(result).toMatchObject({ ok: false, reason: "needs_discord" });
      expect((await readRow())?.summaryStatus).toBe("needs_discord");
    });
  });

  describe("sendActivitySummaryNowAction", () => {
    it("checks the manage-integrations permission", async () => {
      getUserAccessLevelMock.mockResolvedValue("member");

      expect(await sendActivitySummaryNowAction()).toMatchObject({
        ok: false,
        reason: "unauthorized",
      });
    });
  });
});
