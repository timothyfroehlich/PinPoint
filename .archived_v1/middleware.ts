import { type NextRequest } from "next/server";
import { updateSession } from "~/utils/supabase/middleware";

/**
 * Alpha Single-Org Middleware
 * Only handles Supabase session refresh
 * No subdomain routing or org resolution
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
