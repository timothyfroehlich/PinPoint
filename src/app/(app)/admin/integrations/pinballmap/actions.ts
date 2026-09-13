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
import {
  checkPinballMapLocationSchema,
  clearPinballMapLocationSchema,
  commitCheckedPinballMapLocationSchema,
} from "./schema";
import type {
  CheckPinballMapLocationActionResult,
  ClearPinballMapLocationActionResult,
  CommitCheckedPinballMapLocationActionResult,
  PinballMapAllowanceView,
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
    if (result.ok) await reconcileAfterSync();
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
