import { NextResponse } from "next/server";

import { errorMessage } from "~/lib/errors";
import { isProductionBuild } from "~/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (isProductionBuild()) {
    return new Response(null, { status: 404 });
  }

  // Minimal connectivity check to the configured POSTGRES_URL
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
        error: errorMessage(error, "Unknown error"),
      },
      { status: 500 }
    );
  }
}
