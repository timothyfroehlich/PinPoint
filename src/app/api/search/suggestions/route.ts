import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSearchSuggestions } from "~/lib/services/search-service";
import { getRequestAuthContext } from "~/server/auth/context";
import { isError, getErrorMessage } from "~/lib/utils/type-guards";

const SuggestionsQuerySchema = z.object({
  q: z.string().min(2, "Query must be at least 2 characters"),
  entities: z.string().optional().default("all"),
  limit: z.coerce.number().min(1).max(10).optional().default(5),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const { q: query, limit } = SuggestionsQuerySchema.parse(queryParams);

    const auth = await getRequestAuthContext();
    if (auth.kind !== 'authorized') {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Member access required',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }
    const organizationId = auth.org.id;

    // Get search suggestions
    const suggestions = await getSearchSuggestions(
      query,
      organizationId,
      limit,
    );

    return NextResponse.json({
      suggestions,
      query,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search suggestions error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Handle authentication errors
    if (isError(error) && error.message.includes("required")) {
      return NextResponse.json(
        {
          error: "Authentication required",
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        error: "Internal server error",
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
