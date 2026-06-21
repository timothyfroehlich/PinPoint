import { NextResponse } from "next/server";
import { syncLocationSnapshot } from "~/lib/pinballmap/sync";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { log } from "~/lib/logger";

/**
 * Scheduler-agnostic PinballMap location-snapshot sync (bead C / PP-o355.3).
 *
 * Fetches our location's full JSON via the client seam and stores the whole
 * snapshot, refreshing per-machine PBM status + desync detection. CRON_SECRET-
 * gated. The hourly Vercel Cron schedule is wired at rollout (PP-o355.10), not
 * here — the route works on demand (and via "Sync now") meanwhile.
 */

export const dynamic = "force-dynamic";
// A full location fetch + store can exceed the default; PBM payloads are large.
export const maxDuration = 120;

export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const result = await syncLocationSnapshot();
  if (!result.ok) {
    log.error(
      { err: result.error, action: "pinballmap.syncLocationSnapshot" },
      "PinballMap snapshot sync failed"
    );
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }

  log.info(
    {
      machineCount: result.machineCount,
      action: "pinballmap.syncLocationSnapshot",
    },
    "PinballMap snapshot synced"
  );
  return NextResponse.json({ ok: true, machineCount: result.machineCount });
}
