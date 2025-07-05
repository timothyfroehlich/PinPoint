import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  (await cookies()).delete("next-auth.session-token.impersonated");

  return new NextResponse(null, { status: 200 });
}
