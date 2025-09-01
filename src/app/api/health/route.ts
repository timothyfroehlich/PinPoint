import { NextResponse } from "next/server";
import { checkSystemHealth } from "~/lib/dal/system-health";

export async function GET(): Promise<NextResponse> {
  const healthStatus = await checkSystemHealth();

  return NextResponse.json(
    healthStatus,
    { status: healthStatus.status === "healthy" ? 200 : 503 }
  );
}
