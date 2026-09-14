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
import { postChannelMessage } from "~/lib/discord/client";
import { getPinballMapState } from "~/lib/pinballmap/state";
import { normalizeRegion } from "~/lib/pinballmap/config";
import { bootstrapRegion } from "~/lib/pinballmap/region-alerts";
import {
  checkPinballMapLocationSchema,
  clearPinballMapLocationSchema,
  commitCheckedPinballMapLocationSchema,
  saveRegionAlertConfigSchema,
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
    const rawAlertChannel = parsed.data.alertChannelId?.trim();
    const alertChannelId =
      rawAlertChannel !== undefined && rawAlertChannel.length > 0
        ? rawAlertChannel
        : null;

    let status: RegionAlertChannelStatus = "not_configured";
    let statusDetail: string | null = null;

    if (alertChannelId === null) {
      status = "not_configured";
      statusDetail = null;
    } else {
      const botToken = await getDiscordBotToken();
      if (!botToken) {
        status = "needs_discord";
        statusDetail = "Discord bot token not configured";
      } else {
        try {
          const res = await fetch(
            `https://discord.com/api/v10/channels/${alertChannelId}`,
            {
              headers: { Authorization: `Bot ${botToken}` },
            }
          );
          if (res.status === 401) {
            status = "needs_discord";
            statusDetail = "Discord bot token is invalid";
          } else if (res.status === 403 || res.status === 404) {
            status = "cant_post";
            statusDetail = "Channel not found or bot lacks access";
          } else if (res.status === 429 || res.status >= 500) {
            status = "couldnt_check";
            statusDetail = "Discord was unreachable";
          } else if (res.ok) {
            const body = (await res.json()) as {
              permissions?: string;
              type?: number;
            };
            if (body.type === 4 || body.type === 15) {
              status = "cant_post";
              statusDetail =
                "Selected channel cannot receive direct text messages";
            } else if (body.permissions !== undefined) {
              const perms = BigInt(body.permissions);
              // SEND_MESSAGES is bit 11 (2048)
              const canSend = (perms & BigInt(2048)) !== 0n;
              if (!canSend) {
                status = "cant_post";
                statusDetail =
                  "Bot missing Send Messages permission in this channel";
              } else {
                status = "posting";
                statusDetail = null;
              }
            } else {
              status = "posting";
              statusDetail = null;
            }
          } else {
            status = "couldnt_check";
            statusDetail = "Discord returned an unexpected response";
          }
        } catch (err) {
          log.warn(
            { err, action: "saveRegionAlertConfigAction.validateChannel" },
            "Discord channel check failed"
          );
          status = "couldnt_check";
          statusDetail = "Discord was unreachable";
        }
      }
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

export async function sendRegionAlertTestAction(
  first: unknown,
  second?: unknown
): Promise<SendRegionAlertTestActionResult> {
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
    const channelId =
      parsed.data.channelId ??
      (currentState?.regionAlertChannelId?.trim().length
        ? currentState.regionAlertChannelId.trim()
        : undefined);

    if (!channelId) {
      return {
        ok: false,
        reason: "not_configured",
        message: "No alert channel configured to test.",
      };
    }

    const botToken = await getDiscordBotToken();
    if (!botToken) {
      await db
        .insert(pinballmapState)
        .values({
          id: "singleton",
          regionAlertStatus: "needs_discord",
          regionAlertLastStatusDetail: "Discord bot token not configured",
          updatedAt: new Date(),
          updatedBy: authorization.userId,
        })
        .onConflictDoUpdate({
          target: pinballmapState.id,
          set: {
            regionAlertStatus: "needs_discord",
            regionAlertLastStatusDetail: "Discord bot token not configured",
            updatedAt: new Date(),
            updatedBy: authorization.userId,
          },
        });
      revalidatePath(INTEGRATIONS_PATH);
      return {
        ok: false,
        reason: "needs_discord",
        message: "Discord bot token not configured.",
      };
    }

    let channelName: string | undefined;
    try {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}`,
        {
          headers: { Authorization: `Bot ${botToken}` },
        }
      );
      if (res.ok) {
        const body = (await res.json()) as { name?: string };
        if (body.name) channelName = body.name;
      }
    } catch {
      // Best-effort channel name lookup
    }

    const content = channelName
      ? `[PinPoint] Test alert: Region alerts are connected to #${channelName}.\nData from Pinball Map (CC BY-SA 4.0).`
      : `[PinPoint] Test alert: Region alerts are connected to this channel.\nData from Pinball Map (CC BY-SA 4.0).`;

    const sent = await postChannelMessage({
      botToken,
      channelId,
      content,
    });

    if (sent.ok) {
      const wasAlertConfigured = Boolean(
        currentState?.regionAlertChannelId &&
        currentState.regionAlertChannelId.trim().length > 0
      );

      await db
        .insert(pinballmapState)
        .values({
          id: "singleton",
          regionAlertChannelId: channelId,
          regionAlertStatus: "posting",
          regionAlertLastPostAt: new Date(),
          regionAlertLastStatusDetail: "Test message delivered",
          updatedAt: new Date(),
          updatedBy: authorization.userId,
        })
        .onConflictDoUpdate({
          target: pinballmapState.id,
          set: {
            regionAlertChannelId: channelId,
            regionAlertStatus: "posting",
            regionAlertLastPostAt: new Date(),
            regionAlertLastStatusDetail: "Test message delivered",
            updatedAt: new Date(),
            updatedBy: authorization.userId,
          },
        });

      if (!wasAlertConfigured) {
        try {
          await bootstrapRegion(currentState?.regionAlertRegion ?? "austin");
        } catch (err) {
          log.error(
            {
              err,
              region: currentState?.regionAlertRegion ?? "austin",
              action: "sendRegionAlertTestAction.bootstrapRegion",
            },
            "Failed to bootstrap region on test message activation"
          );
        }
      }

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

    await db
      .insert(pinballmapState)
      .values({
        id: "singleton",
        regionAlertChannelId: channelId,
        regionAlertStatus: newStatus,
        regionAlertLastStatusDetail: statusDetail,
        updatedAt: new Date(),
        updatedBy: authorization.userId,
      })
      .onConflictDoUpdate({
        target: pinballmapState.id,
        set: {
          regionAlertChannelId: channelId,
          regionAlertStatus: newStatus,
          regionAlertLastStatusDetail: statusDetail,
          updatedAt: new Date(),
          updatedBy: authorization.userId,
        },
      });
    revalidatePath(INTEGRATIONS_PATH);

    return { ok: false, reason: newStatus, message: statusDetail };
  } catch (error) {
    reportError(error, {
      action: "sendRegionAlertTestAction",
      bestEffort: false,
    });
    revalidatePath(INTEGRATIONS_PATH);
    return { ok: false, reason: "server_error" };
  }
}
