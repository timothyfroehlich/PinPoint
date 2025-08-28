import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";
import { updateUserOrganization } from "~/lib/supabase/rls-helpers";
import { env } from "~/env";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const organizationId = searchParams.get("organizationId");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && organizationId) {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        try {
          // Update user app_metadata with organization ID using admin client
          await updateUserOrganization(user.id, organizationId);
        } catch (updateError) {
          console.error("Failed to update user organization:", updateError);
          return NextResponse.redirect(
            `${request.nextUrl.origin}/auth/auth-code-error?error=organization_setup_failed`,
          );
        }
      }
      
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
    } else if (!error) {
      // No organization ID provided - redirect to error
      return NextResponse.redirect(
        `${request.nextUrl.origin}/auth/auth-code-error?error=missing_organization`,
      );
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(
    `${request.nextUrl.origin}/auth/auth-code-error`,
  );
}
