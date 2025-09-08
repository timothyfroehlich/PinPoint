import { createClient } from "~/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  const supabase = await createClient();
  await supabase.auth.signOut();

  // Redirect to root domain after sign out to clear subdomain context
  return NextResponse.redirect(new URL(redirectTo, origin));
}
