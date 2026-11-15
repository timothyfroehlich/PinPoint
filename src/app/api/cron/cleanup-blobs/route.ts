import type { NextResponse } from "next/server";
import { cleanupOrphanedBlobs } from "~/lib/blob/cleanup";
import { runCron } from "~/lib/cron/run-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  return runCron(request, "blob.cleanup", cleanupOrphanedBlobs);
}
