import { NextResponse } from "next/server";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import {
  authorizeQuickSearch,
  limitQuickSearch,
} from "~/app/api/quick-search/access";
import {
  quickSearchQuerySchema,
  searchQuickIssues,
} from "~/app/api/quick-search/queries";

export async function GET(request: Request): Promise<NextResponse> {
  const access = await authorizeQuickSearch();
  if (access instanceof NextResponse) return access;

  const parsedQuery = quickSearchQuerySchema.safeParse(
    new URL(request.url).searchParams.get("q") ?? ""
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid search query" },
      { status: 400 }
    );
  }

  const limited = await limitQuickSearch(request, access.userId);
  if (limited) return limited;

  try {
    return NextResponse.json(await searchQuickIssues(parsedQuery.data));
  } catch (error) {
    log.error({ err: error }, "Quick search failed");
    reportError(error, { action: "quickSearch.issues" });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
