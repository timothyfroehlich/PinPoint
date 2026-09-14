/**
 * Integration Test: Pinball Map Region Alerts Admin Configuration (PP-o355.51.7)
 *
 * Real PGlite testing for saveRegionAlertConfigAction and sendRegionAlertTestAction.
 * Validates permission checks, input validation, Discord channel permission validation,
 * silent region bootstrapping, state persistence (CORE-ARCH-012), and test alert delivery.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { pinballmapState } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import type * as RegionAlertsModule from "~/lib/pinballmap/region-alerts";

const ADMIN_ID = "5d9e7234-b866-4ce4-8419-d2e27d014acf";

const {
  createClientMock,
  getUserAccessLevelMock,
  revalidatePathMock,
  getDiscordBotTokenMock,
  postChannelMessageMock,
  bootstrapRegionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getUserAccessLevelMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getDiscordBotTokenMock: vi.fn(),
  postChannelMessageMock: vi.fn(),
  bootstrapRegionMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("~/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: getUserAccessLevelMock,
}));
vi.mock("~/lib/discord/config", () => ({
  getDiscordBotToken: getDiscordBotTokenMock,
}));
vi.mock("~/lib/discord/client", () => ({
  postChannelMessage: postChannelMessageMock,
}));
vi.mock("~/lib/pinballmap/region-alerts", async () => {
  const actual = await vi.importActual<typeof RegionAlertsModule>(
    "~/lib/pinballmap/region-alerts"
  );
  return {
    ...actual,
    bootstrapRegion: bootstrapRegionMock,
  };
});

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

import {
  saveRegionAlertConfigAction,
  sendRegionAlertTestAction,
} from "~/app/(app)/admin/integrations/pinballmap/actions";

describe("Pinball Map Region Alerts Admin Configuration", () => {
  setupTestDb();

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await getTestDb();

    await db
      .insert(pinballmapState)
      .values({
        id: "singleton",
        regionAlertRegion: "austin",
        regionAlertChannelId: null,
        regionAlertStatus: "not_configured",
        regionAlertLastPostAt: null,
        regionAlertLastStatusDetail: null,
      })
      .onConflictDoUpdate({
        target: pinballmapState.id,
        set: {
          regionAlertRegion: "austin",
          regionAlertChannelId: null,
          regionAlertStatus: "not_configured",
          regionAlertLastPostAt: null,
          regionAlertLastStatusDetail: null,
        },
      });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: ADMIN_ID } },
        }),
      },
    });
    getUserAccessLevelMock.mockResolvedValue("admin");
    getDiscordBotTokenMock.mockResolvedValue("mock-bot-token");
    postChannelMessageMock.mockResolvedValue({ ok: true });
    bootstrapRegionMock.mockResolvedValue(undefined);
  });

  describe("Permissions", () => {
    it("rejects non-admin users with unauthorized", async () => {
      getUserAccessLevelMock.mockResolvedValue("member");

      const saveRes = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "123456789",
      });
      const testRes = await sendRegionAlertTestAction({
        channelId: "123456789",
      });

      expect(saveRes).toEqual({ ok: false, reason: "unauthorized" });
      expect(testRes).toEqual({ ok: false, reason: "unauthorized" });
    });
  });

  describe("Input validation", () => {
    it("rejects empty region", async () => {
      const res = await saveRegionAlertConfigAction({
        region: "   ",
        alertChannelId: "123456789",
      });
      expect(res).toEqual({ ok: false, reason: "invalid" });
    });

    it("rejects empty channel ID for test message", async () => {
      const res = await sendRegionAlertTestAction({
        channelId: "   ",
      });
      expect(res).toEqual({ ok: false, reason: "invalid" });
    });
  });

  describe("saveRegionAlertConfigAction", () => {
    it("clearing alertChannelId persists not_configured status", async () => {
      const db = await getTestDb();
      await db
        .update(pinballmapState)
        .set({
          regionAlertChannelId: "999",
          regionAlertStatus: "posting",
        })
        .where(eq(pinballmapState.id, "singleton"));

      const res = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "",
      });

      expect(res).toEqual({
        ok: true,
        status: "not_configured",
        statusDetail: null,
      });

      const [updated] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(updated?.regionAlertChannelId).toBeNull();
      expect(updated?.regionAlertStatus).toBe("not_configured");
    });

    it("marks status as posting when Discord channel has SEND_MESSAGES permission", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "123456789",
            name: "new-machines",
            permissions: "2048", // SEND_MESSAGES
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "123456789",
      });

      expect(res).toEqual({
        ok: true,
        status: "posting",
        statusDetail: null,
      });

      const db = await getTestDb();
      const [updated] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(updated?.regionAlertChannelId).toBe("123456789");
      expect(updated?.regionAlertStatus).toBe("posting");
      expect(updated?.regionAlertLastStatusDetail).toBeNull();

      fetchSpy.mockRestore();
    });

    it("marks status as cant_post when bot lacks SEND_MESSAGES permission", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "123456789",
            name: "announcements",
            permissions: "1024", // Does not have 2048
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "123456789",
      });

      expect(res).toEqual({
        ok: true,
        status: "cant_post",
        statusDetail: "Bot missing Send Messages permission in this channel",
      });

      // CORE-ARCH-012: The save always persists the entered config even when validation fails.
      const db = await getTestDb();
      const [updated] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(updated?.regionAlertChannelId).toBe("123456789");
      expect(updated?.regionAlertStatus).toBe("cant_post");

      fetchSpy.mockRestore();
    });

    it("marks status as cant_post when channel returns 404", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

      const res = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "non-existent-channel",
      });

      expect(res).toEqual({
        ok: true,
        status: "cant_post",
        statusDetail: "Channel not found or bot lacks access",
      });

      const db = await getTestDb();
      const [updated] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(updated?.regionAlertChannelId).toBe("non-existent-channel");
      expect(updated?.regionAlertStatus).toBe("cant_post");

      fetchSpy.mockRestore();
    });

    it("marks status as couldnt_check when Discord returns 429", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }));

      const res = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "123456789",
      });

      expect(res).toEqual({
        ok: true,
        status: "couldnt_check",
        statusDetail: "Discord was unreachable",
      });

      fetchSpy.mockRestore();
    });

    it("marks status as needs_discord when bot token is not configured", async () => {
      getDiscordBotTokenMock.mockResolvedValueOnce(null);

      const res = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "123456789",
      });

      expect(res).toEqual({
        ok: true,
        status: "needs_discord",
        statusDetail: "Discord bot token not configured",
      });
    });

    it("triggers bootstrapRegion when region changes", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "123456789",
            permissions: "2048",
          }),
          { status: 200 }
        )
      );

      await saveRegionAlertConfigAction({
        region: "dallas",
        alertChannelId: "123456789",
      });

      expect(bootstrapRegionMock).toHaveBeenCalledWith("dallas");

      const db = await getTestDb();
      const [updated] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(updated?.regionAlertRegion).toBe("dallas");

      fetchSpy.mockRestore();
    });

    it("marks status as cant_post when Discord channel is a category (type 4)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "123456789",
            name: "Text Channels",
            type: 4, // GUILD_CATEGORY
            permissions: "2048",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "123456789",
      });

      expect(res).toEqual({
        ok: true,
        status: "cant_post",
        statusDetail: "Selected channel cannot receive direct text messages",
      });

      fetchSpy.mockRestore();
    });

    it("creates pinballmapState singleton row if not present on save (upsert)", async () => {
      const db = await getTestDb();
      await db.delete(pinballmapState);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "123456789",
            name: "new-machines",
            permissions: "2048",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await saveRegionAlertConfigAction({
        region: "austin",
        alertChannelId: "123456789",
      });

      expect(res.ok).toBe(true);

      const [created] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(created).toBeDefined();
      expect(created?.regionAlertChannelId).toBe("123456789");
      expect(created?.regionAlertStatus).toBe("posting");

      fetchSpy.mockRestore();
    });
  });

  describe("sendRegionAlertTestAction", () => {
    it("returns needs_discord when bot token is missing", async () => {
      getDiscordBotTokenMock.mockResolvedValueOnce(null);

      const res = await sendRegionAlertTestAction({
        channelId: "123456789",
      });

      expect(res).toEqual({
        ok: false,
        reason: "needs_discord",
        message: "Discord bot token not configured.",
      });

      const db = await getTestDb();
      const [updated] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(updated?.regionAlertStatus).toBe("needs_discord");
    });

    it("delivers test message with CC BY-SA 4.0 attribution and marks status as posting", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ name: "alerts-feed" }), { status: 200 })
        );

      const res = await sendRegionAlertTestAction({
        channelId: "123456789",
      });

      expect(res).toEqual({
        ok: true,
        channelName: "alerts-feed",
      });

      expect(postChannelMessageMock).toHaveBeenCalledWith({
        botToken: "mock-bot-token",
        channelId: "123456789",
        content: expect.stringContaining("CC BY-SA 4.0"),
      });
      expect(postChannelMessageMock).toHaveBeenCalledWith({
        botToken: "mock-bot-token",
        channelId: "123456789",
        content: expect.stringContaining("#alerts-feed"),
      });

      const db = await getTestDb();
      const [updated] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(updated?.regionAlertStatus).toBe("posting");
      expect(updated?.regionAlertLastStatusDetail).toBe(
        "Test message delivered"
      );
      expect(updated?.regionAlertLastPostAt).not.toBeNull();

      fetchSpy.mockRestore();
    });

    it("updates status to cant_post when postChannelMessage is blocked", async () => {
      postChannelMessageMock.mockResolvedValueOnce({
        ok: false,
        reason: "blocked",
      });

      const res = await sendRegionAlertTestAction({
        channelId: "123456789",
      });

      expect(res).toEqual({
        ok: false,
        reason: "cant_post",
        message: "Channel unreachable or bot missing permissions",
      });

      const db = await getTestDb();
      const [updated] = await db
        .select()
        .from(pinballmapState)
        .where(eq(pinballmapState.id, "singleton"));
      expect(updated?.regionAlertStatus).toBe("cant_post");
    });

    it("tests configured channel when channelId is omitted", async () => {
      const db = await getTestDb();
      await db
        .update(pinballmapState)
        .set({
          regionAlertChannelId: "configured-channel-123",
        })
        .where(eq(pinballmapState.id, "singleton"));

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "configured-feed" }), {
          status: 200,
        })
      );

      const res = await sendRegionAlertTestAction({});

      expect(res).toEqual({
        ok: true,
        channelName: "configured-feed",
      });

      expect(postChannelMessageMock).toHaveBeenCalledWith({
        botToken: "mock-bot-token",
        channelId: "configured-channel-123",
        content: expect.stringContaining("#configured-feed"),
      });

      fetchSpy.mockRestore();
    });

    it("returns not_configured when no channelId is provided and none configured", async () => {
      const res = await sendRegionAlertTestAction({});

      expect(res).toEqual({
        ok: false,
        reason: "not_configured",
        message: "No alert channel configured to test.",
      });
    });
  });
});
