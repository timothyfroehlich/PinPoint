import { NextResponse } from "next/server";
import { refreshCatalog } from "~/lib/pinballmap/catalog";
import { assertCronAuthorized } from "~/lib/cron/auth";
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
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const count = await refreshCatalog();
    log.info(
      { count, action: "pinballmap.refreshCatalog" },
      "Catalog refreshed"
    );
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    log.error({ err }, "PinballMap catalog refresh cron failed");
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
