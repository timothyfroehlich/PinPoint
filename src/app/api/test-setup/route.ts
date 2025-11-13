import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // Minimal connectivity check to the configured DATABASE_URL
  // Does not leak any data – just ensures the connection is valid
  try {
    // Lazy import to avoid loading db module during build
    const { db } = await import("~/server/db");
    await db.execute("select 1");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
