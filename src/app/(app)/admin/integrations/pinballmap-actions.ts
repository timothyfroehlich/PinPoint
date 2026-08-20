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
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
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
  "VALIDATION" | "FETCH" | "CONFLICT" | "THROTTLED" | "SERVER"
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
      // Enable runs last (below), so at this point the integration is still
      // disabled and changeLocation would take its no-fetch 6.7 branch —
      // committing an unvalidated id and leaving the OLD venue's lineup stored
      // under it, which machine pages then read as fact. When the end state is
      // enabled, validate first regardless of the current flag.
      validateWhileDisabled: targetEnabled,
    });
    if (!result.ok && result.reason === "throttled") {
      revalidatePath(INTEGRATIONS_PATH);
      return err(
        "THROTTLED",
        "Rate limit reached — wait a moment and try again."
      );
    }
    if (!result.ok && result.reason === "fetch_failed") {
      revalidatePath(INTEGRATIONS_PATH);
      return err(
        "FETCH",
        `Pinball Map couldn't load location ${String(targetLocation)}. The tracked location is unchanged.`
      );
    }
    if (!result.ok) {
      revalidatePath(INTEGRATIONS_PATH);
      // A turn-off above has already committed, so "nothing changed" would
      // itself be a lie in that case — say which half landed.
      const turnedOff = enableChanged && !targetEnabled;
      return err(
        "CONFLICT",
        result.reason === "unchanged"
          ? turnedOff
            ? "Pinball Map was turned off. Another save had already moved the location there, so this one changed nothing further."
            : "Another save had already moved the location there, so this one changed nothing. Reload the page."
          : turnedOff
            ? "Pinball Map was turned off, but another change landed first so the location is unchanged. Reload the page."
            : "Another change landed first. Reload the page and try again."
      );
    }
  }

  // Enable last so its refresh reads whatever location is now stored — unless
  // the location also changed, in which case changeLocation above already
  // fetched and stored that venue's lineup and a second fetch would be one
  // extra Pinball Map call per save (CORE-PBM-001).
  let warning: string | undefined;
  if (enableChanged && targetEnabled) {
    const result = await setEnabled({
      enabled: true,
      updatedBy: userId,
      skipRefresh: locationChanged,
    });
    // The enable itself is already persisted; only the refresh can fail, and it
    // uses the cron trigger so it is never throttled.
    if (!result.ok && result.reason === "error") {
      warning = `Enabled, but the lineup refresh failed: ${result.error}`;
    } else if (!result.ok && result.reason === "superseded") {
      warning =
        "Enabled, but another change moved the location before the lineup could be stored. Sync now to read the new one.";
    }
  }

  // A fresh snapshot was just stored — by `changeLocation`'s validating fetch,
  // by the enable refresh, or both. Every other successful-sync call site
  // reconciles (`syncPinballMapNowAction` below, the cron route, the machine
  // Refresh); skipping it here leaves an abandoned-entry alert standing for up
  // to an hour on a lineup that could answer right now. Concretely: someone
  // takes an orphan down by hand on pinballmap.com while the integration is
  // off, the admin re-enables, and every affected machine page keeps telling
  // its owner to remove an entry that is already gone (CORE-ARCH-012).
  const storedFreshSnapshot =
    warning === undefined &&
    targetEnabled &&
    (locationChanged || enableChanged);
  if (storedFreshSnapshot) await reconcileAfterSync();

  revalidatePath(INTEGRATIONS_PATH);
  // Re-pointing the location replaces the snapshot every machine page derives
  // Listed / Missing / Lingering from, and enabling refreshes it — so the whole
  // /m subtree is stale either way.
  if (locationChanged || enableChanged) revalidatePath("/m", "layout");
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

  const result = await syncLocationSnapshot({ updatedBy: userId });

  if (result.ok) {
    // Every other successful-sync call site reconciles and revalidates /m
    // (m/pinballmap-actions.ts, api/cron/pinballmap-sync). Without it a listing
    // an operator removed on pinballmap.com stays flagged as an abandoned
    // entry, and every machine page keeps rendering the pre-sync lineup, until
    // the hourly cron or a machine-page Refresh catches up.
    await reconcileAfterSync();
    revalidatePath("/m", "layout");
    revalidatePath(INTEGRATIONS_PATH);
    return ok({ machineCount: result.machineCount });
  }
  if (result.reason === "throttled") {
    return err("THROTTLED", "Refresh limit reached. Try again shortly.", {
      retryAfterMs: result.retryAfterMs,
    });
  }
  revalidatePath(INTEGRATIONS_PATH);
  if (result.reason === "superseded") {
    // The fetch worked; the 6.6 guard discarded it because the location moved
    // underneath. Saying "refreshed" here would report a machine count for a
    // venue nobody tracks any more (CORE-ARCH-012).
    return err(
      "SYNC",
      "The tracked location changed while this refresh was running, so its result was discarded. Reload the page and sync again.",
      { retryAfterMs: 0 }
    );
  }
  return err("SYNC", `Sync failed: ${result.error}`, { retryAfterMs: 0 });
}
