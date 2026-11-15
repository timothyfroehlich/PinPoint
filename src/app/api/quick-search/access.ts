import { NextResponse } from "next/server";
import { getUserContext } from "~/lib/auth/context";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { checkQuickSearchLimit, getClientIp } from "~/lib/rate-limit";
import { createClient } from "~/lib/supabase/server";

/**
 * The permission check every quick search request passes (spec 2.6, 7.1).
 * Returns the signed-in user's ID, or the 403 response.
 */
export async function authorizeQuickSearch(): Promise<
  { userId: string | undefined } | NextResponse
> {
  // CORE-SSR-002: createClient → auth.getUser immediately, no logic between.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userContext = user ? await getUserContext(user.id) : null;
  const accessLevel = getAccessLevel(userContext?.role);
  if (
    !checkPermission("machines.view", accessLevel) ||
    !checkPermission("issues.view", accessLevel)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { userId: user?.id };
}

/** The shared quick search rate limit. Returns the 429 response, or null. */
export async function limitQuickSearch(
  request: Request,
  userId: string | undefined
): Promise<NextResponse | null> {
  const clientIp = await getClientIp(request.headers);
  const limitResult = await checkQuickSearchLimit(clientIp, userId);
  if (limitResult.success) return null;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((limitResult.reset - Date.now()) / 1000)
  );
  return NextResponse.json(
    { error: "Quick search rate limit reached" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}
