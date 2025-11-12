import { type NextRequest, type NextResponse } from "next/server";
import { updateSession } from "~/lib/supabase/middleware";

/**
 * Next.js middleware for Supabase SSR authentication
 *
 * Responsibilities:
 * - Refreshes expired auth tokens automatically
 * - Updates cookies for both server and client
 *
 * Required for CORE-SSR-003 compliance
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Assets with extensions (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
