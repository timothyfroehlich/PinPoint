import { NextResponse } from "next/server";
import {
  syncLocationSnapshot,
  getPinballMapState,
} from "~/lib/pinballmap/state";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { log } from "~/lib/logger";

/**
 * PinballMap location-snapshot sync (inbound, automatic — PP-o355.11).
 *
 * Fetches our location's full JSON via the client seam, stores the whole
 * snapshot (foundation `syncLocationSnapshot`), then reconciles stored per-
 * machine lmx drift (`reconcileAfterSync`). CRON_SECRET-gated like the other
 * cron routes.
 *
 * Enabled gate: the route is the caller that owns "should we sync at all"
 * (CORE-PBM-001) — the foundation's `syncLocationSnapshot` deliberately does
 * NOT gate on `state.enabled`. While the integration is disabled (the default)
 * this route makes ZERO PBM calls, so it is safe to register hourly before the
 * integration is turned on. Turning it on + wiring the Vercel Cron schedule is
 * the rollout bead (PP-o355.10); intended cadence is hourly (`0 * * * *`), one
 * location call per hour per PBM conduct.
 */

export const dynamic = "force-dynamic";
// A full location fetch + store can exceed the default; PBM payloads are large.
export const maxDuration = 120;

export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const state = await getPinballMapState();
  if (!state?.enabled) {
    // Dormant: the integration isn't enabled yet. Correct no-op, not an error.
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  // Automated hourly refresh — the sanctioned one-call/hour path, exempt from
  // the manual-refresh throttle (PP-hbi0, CORE-PBM-001).
  const result = await syncLocationSnapshot({ trigger: "cron" });
  if (!result.ok) {
    // The cron path is never throttled, but narrow defensively for type safety.
    const error = result.reason === "throttled" ? "throttled" : result.error;
    log.error(
      { err: error, action: "pinballmap.syncLocationSnapshot" },
      "PinballMap snapshot sync failed"
    );
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }

  const { healed, desynced } = await reconcileAfterSync();
  log.info(
    {
      machineCount: result.machineCount,
      healed,
      desynced,
      action: "pinballmap.syncLocationSnapshot",
    },
    "PinballMap snapshot synced"
  );
  return NextResponse.json({
    ok: true,
    machineCount: result.machineCount,
    healed,
    desynced,
  });
}
