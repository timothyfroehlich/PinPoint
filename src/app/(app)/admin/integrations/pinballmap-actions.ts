"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { ok, err, type Result } from "~/lib/result";
import { APC_LOCATION_ID } from "~/lib/pinballmap/config";
import {
  getPinballMapState,
  changeLocation,
  setEnabled,
  syncLocationSnapshot,
} from "~/lib/pinballmap/state";
import { verifyIntegrationsAdmin } from "./verify-admin";

const INTEGRATIONS_PATH = "/admin/integrations";

// A Pinball Map location id is a positive integer. `coerce` because it arrives
// as a form string; the range guard keeps a fat-fingered "0" or a negative out
// of the fetch.
const saveConfigSchema = z.object({
  enabled: z.boolean(),
  locationId: z.coerce
    .number({ message: "Enter a Pinball Map location id." })
    .int("The location id must be a whole number.")
    .positive("The location id must be a positive number."),
});

/**
 * Result of saving the Pinball Map section. `ok` carries an optional `warning`
 * for the one partial-success case: the config saved but the enable-triggered
 * lineup refresh failed. A location fetch failure or a concurrent change is a
 * hard `err` — nothing was changed.
 */
export type PbmSaveResult = Result<
  { warning?: string },
  "VALIDATION" | "FETCH" | "CONFLICT" | "SERVER"
>;

/**
 * Save the Pinball Map section's config: the enable toggle (spec §5) and the
 * tracked location id (spec §6), each applied only when it actually changed.
 *
 * The two settings are applied in an order that keeps §6.2 honest and avoids a
 * wasted Pinball Map fetch:
 *
 * - **Turning off + changing location** → disable first, then change the id.
 *   A disabled integration makes no Pinball Map call (6.7), so the id moves
 *   without fetching a location we are about to stop syncing.
 * - **Turning on + changing location** → change the id first (still disabled,
 *   so id-only, no fetch), then enable — whose refresh (5.2) reads the *new*
 *   location. One fetch, of the right place.
 *
 * Each underlying call (`changeLocation`, `setEnabled`) is internally
 * validate-before-commit and guarded against a concurrent sync (6.6); this
 * action only sequences them.
 */
export async function savePinballMapConfigAction(
  _prev: PbmSaveResult | undefined,
  formData: FormData
): Promise<PbmSaveResult> {
  const { userId } = await verifyIntegrationsAdmin();

  const parsed = saveConfigSchema.safeParse({
    enabled: formData.get("enabled") === "true",
    locationId: formData.get("locationId"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err("VALIDATION", first?.message ?? "The location id is invalid.");
  }
  const { enabled: targetEnabled, locationId: targetLocation } = parsed.data;

  const state = await getPinballMapState();
  const currentEnabled = state?.enabled ?? false;
  const currentLocation = state?.locationId ?? APC_LOCATION_ID;
  const enableChanged = targetEnabled !== currentEnabled;
  const locationChanged = targetLocation !== currentLocation;
  if (!enableChanged && !locationChanged) return ok({});

  // Disable-before-location when turning off (see the ordering note above).
  if (enableChanged && !targetEnabled) {
    await setEnabled({ enabled: false, updatedBy: userId });
  }

  if (locationChanged) {
    const result = await changeLocation({
      newLocationId: targetLocation,
      updatedBy: userId,
    });
    if (!result.ok && result.reason === "fetch_failed") {
      revalidatePath(INTEGRATIONS_PATH);
      return err(
        "FETCH",
        `Pinball Map couldn't load location ${String(targetLocation)}. The tracked location is unchanged.`
      );
    }
    if (!result.ok && result.reason === "concurrent_change") {
      revalidatePath(INTEGRATIONS_PATH);
      return err(
        "CONFLICT",
        "Another change landed first. Reload the page and try again."
      );
    }
    // "unchanged" can't reach here — we diffed against stored state first.
  }

  // Enable last so its refresh reads whatever location is now stored.
  let warning: string | undefined;
  if (enableChanged && targetEnabled) {
    const result = await setEnabled({ enabled: true, updatedBy: userId });
    // The enable itself is already persisted; only the refresh can fail, and it
    // uses the cron trigger so it is never throttled.
    if (!result.ok && result.reason === "error") {
      warning = `Enabled, but the lineup refresh failed: ${result.error}`;
    }
  }

  revalidatePath(INTEGRATIONS_PATH);
  return warning === undefined ? ok({}) : ok({ warning });
}

/**
 * Result of a Sync now. `THROTTLED` carries the ms until the next token so the
 * button can restart its countdown from the server's authoritative answer.
 */
export type PbmSyncResult = Result<
  { machineCount: number },
  "THROTTLED" | "SYNC",
  { retryAfterMs: number }
>;

/**
 * Refresh the stored lineup snapshot on demand (spec §4.3). Draws a token from
 * the same shared allowance as the machine listing control's Refresh — the
 * throttle lives at the `syncLocationSnapshot` seam (manual trigger), so this
 * action only surfaces its outcome.
 */
export async function syncPinballMapNowAction(
  _prev: PbmSyncResult | undefined,
  _formData: FormData
): Promise<PbmSyncResult> {
  const { userId } = await verifyIntegrationsAdmin();

  const result = await syncLocationSnapshot({
    trigger: "manual",
    updatedBy: userId,
  });

  if (result.ok) {
    revalidatePath(INTEGRATIONS_PATH);
    return ok({ machineCount: result.machineCount });
  }
  if (result.reason === "throttled") {
    return err("THROTTLED", "Refresh limit reached. Try again shortly.", {
      retryAfterMs: result.retryAfterMs,
    });
  }
  revalidatePath(INTEGRATIONS_PATH);
  return err("SYNC", `Sync failed: ${result.error}`, { retryAfterMs: 0 });
}
