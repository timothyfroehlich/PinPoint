"use server";

import { revalidatePath } from "next/cache";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { checkPermission } from "~/lib/permissions/helpers";
import {
  checkTrackedLocation,
  clearTrackedLocation,
  commitCheckedTrackedLocation,
  getRefreshAllowance,
  syncLocationSnapshot,
} from "~/lib/pinballmap/state";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
import { reportError } from "~/lib/observability/report-error";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { log } from "~/lib/logger";
import { getDiscordBotToken } from "~/lib/discord/config";
import {
  DISCORD_MESSAGE_FLAGS,
  postChannelMessage,
} from "~/lib/discord/client";
import {
  checkDiscordChannel,
  fetchDiscordChannelName,
} from "~/lib/discord/channel-check";
import { getPinballMapState } from "~/lib/pinballmap/state";
import { normalizeRegion } from "~/lib/pinballmap/config";
import { bootstrapRegion } from "~/lib/pinballmap/region-alerts";
import { eq } from "drizzle-orm";
import { getRegions } from "~/lib/pinballmap/client";
import {
  checkPinballMapLocationSchema,
  clearPinballMapLocationSchema,
  commitCheckedPinballMapLocationSchema,
  discordSnowflakeRegex,
  saveRegionAlertConfigSchema,
  saveSyncReportConfigSchema,
  sendRegionAlertTestSchema,
} from "./schema";
import type {
  CheckPinballMapLocationActionResult,
  ClearPinballMapLocationActionResult,
  CommitCheckedPinballMapLocationActionResult,
  PinballMapAllowanceView,
  RegionAlertChannelStatus,
  SaveRegionAlertConfigActionResult,
  SendRegionAlertTestActionResult,
  SyncPinballMapNowActionResult,
} from "./types";

const INTEGRATIONS_PATH = "/admin/integrations";

type IntegrationsAuthorization = { ok: true; userId: string } | { ok: false };

async function authorizeIntegrationsAdmin(): Promise<IntegrationsAuthorization> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const accessLevel = await getUserAccessLevel(user.id);
  if (!checkPermission("admin.integrations.manage", accessLevel)) {
    return { ok: false };
  }
  return { ok: true, userId: user.id };
}

async function readAllowance(): Promise<PinballMapAllowanceView> {
  const observedAt = new Date();
  const allowance = await getRefreshAllowance(observedAt);
  return {
    remaining: allowance.remaining,
    nextRefillAtIso: allowance.nextRefillAt?.toISOString() ?? null,
    observedAtIso: observedAt.toISOString(),
  };
}

export async function checkPinballMapLocationAction(
  _previousState: CheckPinballMapLocationActionResult | undefined,
  formData: FormData
): Promise<CheckPinballMapLocationActionResult> {
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) return { ok: false, reason: "unauthorized" };

    const parsed = checkPinballMapLocationSchema.safeParse({
      locationId: formData.get("locationId"),
    });
    if (!parsed.success) return { ok: false, reason: "invalid" };

    const result = await checkTrackedLocation(
      parsed.data.locationId,
      authorization.userId
    );
    const allowance = await readAllowance();
    revalidatePath(INTEGRATIONS_PATH);

    if (!result.ok) {
      return { ok: false, reason: result.reason, allowance };
    }
    return {
      ok: true,
      candidate: {
        checkId: result.candidate.checkId,
        locationId: result.candidate.locationId,
        name: result.candidate.name,
        city: result.candidate.city,
        state: result.candidate.state,
        machineCount: result.candidate.machineCount,
        checkedAtIso: result.candidate.checkedAt.toISOString(),
        expiresAtIso: result.candidate.expiresAt.toISOString(),
      },
      allowance,
    };
  } catch (error) {
    reportError(error, {
      action: "checkPinballMapLocationAction",
      bestEffort: false,
    });
    revalidatePath(INTEGRATIONS_PATH);
    return { ok: false, reason: "server_error" };
  }
}

export async function commitCheckedPinballMapLocationAction(
  _previousState: CommitCheckedPinballMapLocationActionResult | undefined,
  formData: FormData
): Promise<CommitCheckedPinballMapLocationActionResult> {
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) return { ok: false, reason: "unauthorized" };

    const parsed = commitCheckedPinballMapLocationSchema.safeParse({
      checkId: formData.get("checkId"),
    });
    if (!parsed.success) return { ok: false, reason: "invalid" };

    const result = await commitCheckedTrackedLocation(
      parsed.data.checkId,
      authorization.userId,
      authorization.userId
    );
    revalidatePath(INTEGRATIONS_PATH);
    return result;
  } catch (error) {
    reportError(error, {
      action: "commitCheckedPinballMapLocationAction",
      bestEffort: false,
    });
    revalidatePath(INTEGRATIONS_PATH);
    return { ok: false, reason: "server_error" };
  }
}

export async function clearPinballMapLocationAction(
  _previousState: ClearPinballMapLocationActionResult | undefined,
  formData: FormData
): Promise<ClearPinballMapLocationActionResult> {
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) return { ok: false, reason: "unauthorized" };

    const parsed = clearPinballMapLocationSchema.safeParse({
      expectedLocationId: formData.get("expectedLocationId"),
      expectedGeneration: formData.get("expectedGeneration"),
    });
    if (!parsed.success) return { ok: false, reason: "invalid" };

    const result = await clearTrackedLocation(
      parsed.data.expectedLocationId,
      parsed.data.expectedGeneration,
      authorization.userId
    );
    revalidatePath(INTEGRATIONS_PATH);
    return result;
  } catch (error) {
    reportError(error, {
      action: "clearPinballMapLocationAction",
      bestEffort: false,
    });
    revalidatePath(INTEGRATIONS_PATH);
    return { ok: false, reason: "server_error" };
  }
}

export async function syncPinballMapNowAction(
  _previousState: SyncPinballMapNowActionResult | undefined,
  _formData: FormData
): Promise<SyncPinballMapNowActionResult> {
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) return { ok: false, reason: "unauthorized" };

    const result = await syncLocationSnapshot({
      updatedBy: authorization.userId,
      trigger: "manual",
    });
    if (result.ok) await reconcileAfterSync();

    const allowance = await readAllowance();
    revalidatePath(INTEGRATIONS_PATH);
    if (result.ok) return { ok: true, allowance };

    switch (result.reason) {
      case "error":
        return { ok: false, reason: "fetch_failed", allowance };
      case "superseded":
        return { ok: false, reason: "concurrent_change", allowance };
      case "not_configured":
      case "throttled":
      case "busy":
        return { ok: false, reason: result.reason, allowance };
    }
  } catch (error) {
    reportError(error, {
      action: "syncPinballMapNowAction",
      bestEffort: false,
    });
    revalidatePath(INTEGRATIONS_PATH);
    return { ok: false, reason: "server_error" };
  }
}

export async function saveRegionAlertConfigAction(
  first: unknown,
  second?: unknown
): Promise<SaveRegionAlertConfigActionResult> {
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) return { ok: false, reason: "unauthorized" };

    const rawInput = second !== undefined ? second : first;
    let rawRegion: unknown;
    let rawAlertChannelId: unknown;

    if (rawInput instanceof FormData) {
      rawRegion = rawInput.get("region");
      rawAlertChannelId = rawInput.get("alertChannelId");
    } else if (typeof rawInput === "object" && rawInput !== null) {
      const record = rawInput as Record<string, unknown>;
      rawRegion = record["region"];
      rawAlertChannelId = record["alertChannelId"];
    }

    const parsed = saveRegionAlertConfigSchema.safeParse({
      region: rawRegion,
      alertChannelId: rawAlertChannelId,
    });
    if (!parsed.success) return { ok: false, reason: "invalid" };

    const normalizedRegion = normalizeRegion(parsed.data.region);
    const knownRegions = await getRegions();
    if (
      knownRegions.length === 0 ||
      !knownRegions.some((r) => normalizeRegion(r.name) === normalizedRegion)
    ) {
      return { ok: false, reason: "invalid" };
    }

    const rawAlertChannel = parsed.data.alertChannelId?.trim();
    const alertChannelId =
      rawAlertChannel !== undefined && rawAlertChannel.length > 0
        ? rawAlertChannel
        : null;

    if (
      alertChannelId !== null &&
      !discordSnowflakeRegex.test(alertChannelId)
    ) {
      return { ok: false, reason: "invalid" };
    }

    let status: RegionAlertChannelStatus = "not_configured";
    let statusDetail: string | null = null;
    if (alertChannelId !== null) {
      ({ status, statusDetail } = await checkDiscordChannel(
        await getDiscordBotToken(),
        alertChannelId
      ));
    }

    const currentState = await getPinballMapState();
    const previousRegion = currentState?.regionAlertRegion;

    // CORE-ARCH-012: The save always persists the entered config, even when the check fails.
    await db
      .insert(pinballmapState)
      .values({
        id: "singleton",
        regionAlertRegion: normalizedRegion,
        regionAlertChannelId: alertChannelId,
        regionAlertStatus: status,
        regionAlertLastStatusDetail: statusDetail,
        updatedAt: new Date(),
        updatedBy: authorization.userId,
      })
      .onConflictDoUpdate({
        target: pinballmapState.id,
        set: {
          regionAlertRegion: normalizedRegion,
          regionAlertChannelId: alertChannelId,
          regionAlertStatus: status,
          regionAlertLastStatusDetail: statusDetail,
          updatedAt: new Date(),
          updatedBy: authorization.userId,
        },
      });

    const wasAlertConfigured = Boolean(
      currentState?.regionAlertChannelId &&
      currentState.regionAlertChannelId.trim().length > 0
    );
    const isAlertConfigured = alertChannelId !== null;
    const regionChanged = previousRegion !== normalizedRegion;
    const shouldBootstrap =
      isAlertConfigured && (regionChanged || !wasAlertConfigured);

    if (shouldBootstrap) {
      try {
        await bootstrapRegion(normalizedRegion);
      } catch (err) {
        log.error(
          {
            err,
            region: normalizedRegion,
            action: "saveRegionAlertConfigAction.bootstrapRegion",
          },
          "Failed to bootstrap region"
        );
      }
    }

    revalidatePath(INTEGRATIONS_PATH);
    return { ok: true, status, statusDetail };
  } catch (error) {
    reportError(error, {
      action: "saveRegionAlertConfigAction",
      bestEffort: false,
    });
    revalidatePath(INTEGRATIONS_PATH);
    return { ok: false, reason: "server_error" };
  }
}

/**
 * The two admin-configured Pinball Map Discord channels. Each stores its own
 * id and status; the save check, test send, and status rules are shared
 * (region alerts §2.3–§3.3, sync report §2.3–§2.4).
 */
type ChannelKind = "region_alert" | "sync_report";

const CHANNEL_LABEL: Record<ChannelKind, string> = {
  region_alert: "alert channel",
  sync_report: "sync report channel",
};

function storedChannelId(
  state: Awaited<ReturnType<typeof getPinballMapState>>,
  kind: ChannelKind
): string | null {
  const raw =
    kind === "region_alert"
      ? state?.regionAlertChannelId
      : state?.syncReportChannelId;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function channelStatusSet(
  kind: ChannelKind,
  status: RegionAlertChannelStatus,
  statusDetail: string | null,
  lastPostAt?: Date
): Partial<typeof pinballmapState.$inferInsert> {
  if (kind === "region_alert") {
    return {
      regionAlertStatus: status,
      regionAlertLastStatusDetail: statusDetail,
      ...(lastPostAt ? { regionAlertLastPostAt: lastPostAt } : {}),
    };
  }
  return {
    syncReportStatus: status,
    syncReportLastStatusDetail: statusDetail,
    ...(lastPostAt ? { syncReportLastPostAt: lastPostAt } : {}),
  };
}

function testMessage(
  kind: ChannelKind,
  channelName: string | undefined
): string {
  if (kind === "region_alert") {
    return channelName
      ? `[PinPoint] Test alert: Region alerts are connected to #${channelName}.\nData from Pinball Map (CC BY-SA 4.0).`
      : `[PinPoint] Test alert: Region alerts are connected to this channel.\nData from Pinball Map (CC BY-SA 4.0).`;
  }
  return channelName
    ? `[PinPoint] Test message: The weekly Pinball Map sync report will post to #${channelName}.`
    : `[PinPoint] Test message: The weekly Pinball Map sync report will post to this channel.`;
}

async function sendChannelTest(
  kind: ChannelKind,
  first: unknown,
  second: unknown
): Promise<SendRegionAlertTestActionResult> {
  const action =
    kind === "region_alert"
      ? "sendRegionAlertTestAction"
      : "sendSyncReportTestAction";
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) return { ok: false, reason: "unauthorized" };

    const rawInput = second !== undefined ? second : first;
    let rawChannelId: unknown;

    if (rawInput instanceof FormData) {
      rawChannelId = rawInput.get("channelId");
    } else if (typeof rawInput === "object" && rawInput !== null) {
      const record = rawInput as Record<string, unknown>;
      rawChannelId = record["channelId"];
    }

    const parsed = sendRegionAlertTestSchema.safeParse({
      channelId: rawChannelId,
    });
    if (!parsed.success) return { ok: false, reason: "invalid" };

    const currentState = await getPinballMapState();
    const savedChannelId = storedChannelId(currentState, kind);
    const channelId = parsed.data.channelId ?? savedChannelId ?? undefined;
    const label = CHANNEL_LABEL[kind];

    if (!channelId) {
      return {
        ok: false,
        reason: "not_configured",
        message: `No ${label} configured to test.`,
      };
    }

    if (!discordSnowflakeRegex.test(channelId)) {
      return {
        ok: false,
        reason: "not_configured",
        message: `No valid ${label} configured to test.`,
      };
    }

    // Only a test of the saved channel moves its stored status; testing an
    // unsaved edit says nothing about the channel the feature posts to.
    const testsSavedChannel = savedChannelId === channelId;
    const recordStatus = async (
      status: RegionAlertChannelStatus,
      statusDetail: string | null,
      lastPostAt?: Date
    ): Promise<void> => {
      if (!testsSavedChannel) return;
      await db
        .update(pinballmapState)
        .set({
          ...channelStatusSet(kind, status, statusDetail, lastPostAt),
          updatedAt: new Date(),
          updatedBy: authorization.userId,
        })
        .where(eq(pinballmapState.id, "singleton"));
    };

    const botToken = await getDiscordBotToken();
    if (!botToken) {
      await recordStatus("needs_discord", "Discord bot token not configured");
      revalidatePath(INTEGRATIONS_PATH);
      return {
        ok: false,
        reason: "needs_discord",
        message: "Discord bot token not configured.",
      };
    }

    const channelName = await fetchDiscordChannelName(botToken, channelId);
    const sent = await postChannelMessage({
      botToken,
      channelId,
      content: testMessage(kind, channelName),
      ...(kind === "sync_report"
        ? { flags: DISCORD_MESSAGE_FLAGS.SUPPRESS_EMBEDS }
        : {}),
    });

    if (sent.ok) {
      await recordStatus("posting", "Test message delivered", new Date());
      revalidatePath(INTEGRATIONS_PATH);
      return channelName !== undefined
        ? { ok: true, channelName }
        : { ok: true };
    }

    const newStatus: "cant_post" | "couldnt_check" =
      sent.reason === "blocked" ? "cant_post" : "couldnt_check";
    const statusDetail =
      sent.reason === "blocked"
        ? "Channel unreachable or bot missing permissions"
        : "Discord was unreachable";

    await recordStatus(newStatus, statusDetail);
    revalidatePath(INTEGRATIONS_PATH);

    return { ok: false, reason: newStatus, message: statusDetail };
  } catch (error) {
    reportError(error, { action, bestEffort: false });
    revalidatePath(INTEGRATIONS_PATH);
    return { ok: false, reason: "server_error" };
  }
}

export async function sendRegionAlertTestAction(
  first: unknown,
  second?: unknown
): Promise<SendRegionAlertTestActionResult> {
  return sendChannelTest("region_alert", first, second);
}

export async function sendSyncReportTestAction(
  first: unknown,
  second?: unknown
): Promise<SendRegionAlertTestActionResult> {
  return sendChannelTest("sync_report", first, second);
}

/**
 * Save the sync report channel (sync report spec §2.1–§2.3). The entered
 * value always persists, even when the Discord check fails (CORE-ARCH-012).
 */
export async function saveSyncReportConfigAction(
  first: unknown,
  second?: unknown
): Promise<SaveRegionAlertConfigActionResult> {
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) return { ok: false, reason: "unauthorized" };

    const rawInput = second !== undefined ? second : first;
    let rawChannelId: unknown;
    if (rawInput instanceof FormData) {
      rawChannelId = rawInput.get("channelId");
    } else if (typeof rawInput === "object" && rawInput !== null) {
      rawChannelId = (rawInput as Record<string, unknown>)["channelId"];
    }

    const parsed = saveSyncReportConfigSchema.safeParse({
      channelId: rawChannelId,
    });
    if (!parsed.success) return { ok: false, reason: "invalid" };

    const trimmed = parsed.data.channelId?.trim();
    const channelId = trimmed && trimmed.length > 0 ? trimmed : null;

    let status: RegionAlertChannelStatus = "not_configured";
    let statusDetail: string | null = null;
    if (channelId !== null) {
      ({ status, statusDetail } = await checkDiscordChannel(
        await getDiscordBotToken(),
        channelId
      ));
    }

    const fields = {
      syncReportChannelId: channelId,
      ...channelStatusSet("sync_report", status, statusDetail),
      updatedAt: new Date(),
      updatedBy: authorization.userId,
    };
    await db
      .insert(pinballmapState)
      .values({ id: "singleton", ...fields })
      .onConflictDoUpdate({ target: pinballmapState.id, set: fields });

    revalidatePath(INTEGRATIONS_PATH);
    return { ok: true, status, statusDetail };
  } catch (error) {
    reportError(error, {
      action: "saveSyncReportConfigAction",
      bestEffort: false,
    });
    revalidatePath(INTEGRATIONS_PATH);
    return { ok: false, reason: "server_error" };
  }
}
