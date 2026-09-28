import { NextResponse } from "next/server";
import { getUserContext } from "~/lib/auth/context";
import { log } from "~/lib/logger";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { checkQuickSearchLimit, getClientIp } from "~/lib/rate-limit";
import { createClient } from "~/lib/supabase/server";
import {
  quickSearchQuerySchema,
  searchQuickNavigation,
} from "~/app/api/quick-search/queries";

export async function GET(request: Request): Promise<NextResponse> {
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

  const parsedQuery = quickSearchQuerySchema.safeParse(
    new URL(request.url).searchParams.get("q") ?? ""
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid search query" },
      { status: 400 }
    );
  }

  const clientIp = await getClientIp(request.headers);
  const limitResult = await checkQuickSearchLimit(clientIp, user?.id);
  if (!limitResult.success) {
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

  try {
    return NextResponse.json(await searchQuickNavigation(parsedQuery.data));
  } catch (error) {
    log.error({ err: error }, "Quick search failed");
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
