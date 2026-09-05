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
 * A non-null configured location is required. While it is absent this route
 * makes zero PBM calls, so it is safe to register hourly before configuration.
 */

export const dynamic = "force-dynamic";
// A full location fetch + store can exceed the default; PBM payloads are large.
export const maxDuration = 120;

export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const state = await getPinballMapState();
  if (state?.locationId === null || state?.locationId === undefined) {
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }

  // Automated hourly refresh — the sanctioned one-call/hour path, exempt from
  // the manual-refresh throttle (PP-hbi0, CORE-PBM-001).
  const result = await syncLocationSnapshot({ trigger: "cron" });
  if (!result.ok) {
    if (result.reason === "superseded") {
      log.info(
        { action: "pinballmap.syncLocationSnapshot" },
        "PinballMap snapshot sync was superseded by a location change"
      );
      return NextResponse.json({ ok: true, skipped: "superseded" });
    }
    if (result.reason === "busy") {
      log.info(
        { action: "pinballmap.syncLocationSnapshot" },
        "PinballMap snapshot sync deferred while a configuration-sensitive mutation is running"
      );
      return NextResponse.json({ ok: true, skipped: "busy" });
    }
    // The cron path is never throttled, but narrow defensively for type safety.
    const error =
      result.reason === "throttled"
        ? "throttled"
        : result.reason === "not_configured"
          ? "not_configured"
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
