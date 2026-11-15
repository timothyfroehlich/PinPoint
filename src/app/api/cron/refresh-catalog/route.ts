import type { NextResponse } from "next/server";
import { refreshCatalog } from "~/lib/pinballmap/catalog";
import { runCron } from "~/lib/cron/run-cron";
import { log } from "~/lib/logger";

/**
 * Weekly refresh of the local PinballMap catalog mirror (bead B / PP-o355.2).
 *
 * PBM recommends caching the catalog locally rather than polling per keystroke,
 * so a single weekly bulk fetch keeps the linking picker fast and respectful of
 * PBM's rate limits. CRON_SECRET-gated like the other cron routes.
 */

export const dynamic = "force-dynamic";
// The bulk catalog fetch + chunked upsert can run longer than the default.
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  return runCron(request, "pinballmap.refreshCatalog", async () => {
    const count = await refreshCatalog();
    log.info(
      { count, action: "pinballmap.refreshCatalog" },
      "Catalog refreshed"
    );
    return { ok: true, count };
  });
}
