import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";
import { env } from "~/env";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Authentication successful - user is now organization-agnostic
      // Organization context will be determined per-request from subdomain

      // Redirect to the appropriate subdomain URL
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`http://localhost:3000${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${request.nextUrl.origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(
    `${request.nextUrl.origin}/auth/auth-code-error`,
  );
}
