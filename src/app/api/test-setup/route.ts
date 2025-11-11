import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // Minimal connectivity check to the configured DATABASE_URL
  // Does not leak any data – just ensures the connection is valid
  await db.execute("select 1");
  return NextResponse.json({ ok: true });
}
