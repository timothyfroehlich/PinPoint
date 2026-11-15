import type { NextResponse } from "next/server";
import { refreshOpdbRecords } from "~/lib/opdb/records";
import { runCron } from "~/lib/cron/run-cron";
import { log } from "~/lib/logger";
import { db } from "~/server/db";

/**
 * Daily refresh of the stored OPDB copy (PP-wqit.12) from OPDB's full export,
 * which is itself rebuilt once a day. CRON_SECRET-gated like the other cron
 * routes. A failure keeps the previous copy; tags keep reading it.
 */

export const dynamic = "force-dynamic";
// A 5.6 MB download plus a few chunked upserts; allow more than the default.
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  return runCron(request, "opdb.refresh", async () => {
    const count = await refreshOpdbRecords(db);
    log.info({ count, action: "opdb.refresh" }, "OPDB copy refreshed");
    return { ok: true, count };
  });
}
