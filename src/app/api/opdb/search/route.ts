import { NextResponse } from "next/server";

import { searchOpdbModels } from "~/lib/opdb/client";
import {
  opdbSearchQuerySchema,
  opdbSearchResponseSchema,
} from "~/lib/opdb/types";
import { createClient } from "~/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const parsedQuery = opdbSearchQuerySchema.safeParse(
    requestUrl.searchParams.get("q") ?? ""
  );

  if (!parsedQuery.success) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchOpdbModels(parsedQuery.data);
  const responseBody = opdbSearchResponseSchema.parse({ results });

  return NextResponse.json(responseBody);
}
