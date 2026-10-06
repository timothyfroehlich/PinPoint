import { NextResponse } from "next/server";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import {
  authorizeQuickSearch,
  limitQuickSearch,
} from "~/app/api/quick-search/access";
import { listQuickSearchMachines } from "~/app/api/quick-search/queries";

export async function GET(request: Request): Promise<NextResponse> {
  const access = await authorizeQuickSearch();
  if (access instanceof NextResponse) return access;

  const limited = await limitQuickSearch(request, access.userId);
  if (limited) return limited;

  try {
    return NextResponse.json(await listQuickSearchMachines());
  } catch (error) {
    log.error({ err: error }, "Quick search machine list failed");
    reportError(error, { action: "quickSearch.machines" });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
