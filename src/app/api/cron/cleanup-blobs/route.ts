import { NextResponse } from "next/server";
import { cleanupOrphanedBlobs } from "~/lib/blob/cleanup";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { log } from "~/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const result = await cleanupOrphanedBlobs();
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err }, "Blob cleanup cron failed");
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
