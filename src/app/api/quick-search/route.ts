import { NextResponse } from "next/server";
import { getUserContext } from "~/lib/auth/context";
import { log } from "~/lib/logger";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { createClient } from "~/lib/supabase/server";
import {
  normalizeQuickSearchQuery,
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

  const query = normalizeQuickSearchQuery(
    new URL(request.url).searchParams.get("q") ?? ""
  );

  try {
    return NextResponse.json(await searchQuickNavigation(query));
  } catch (error) {
    log.error({ err: error }, "Quick search failed");
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
