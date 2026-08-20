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

  const result = await syncLocationSnapshot();
  if (!result.ok) {
    // `superseded` is the 6.6 guard: an admin re-pointed the location while
    // this hourly fetch was in flight, so its snapshot was discarded. Not an
    // error to chase — the next run reads the new location — but it must not be
    // logged as a success either.
    const error =
      result.reason === "throttled"
        ? "throttled"
        : result.reason === "superseded"
          ? "superseded by a location change"
          : result.error;
    log.error(
      { err: error, action: "pinballmap.syncLocationSnapshot" },
      "PinballMap snapshot sync failed"
    );
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }

  const { abandonmentsCleared } = await reconcileAfterSync();
  log.info(
    {
      machineCount: result.machineCount,
      abandonmentsCleared,
      action: "pinballmap.syncLocationSnapshot",
    },
    "PinballMap snapshot synced"
  );
  return NextResponse.json({
    ok: true,
    machineCount: result.machineCount,
    abandonmentsCleared,
  });
}
