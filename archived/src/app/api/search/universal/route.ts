import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sortOrderSchema } from "~/lib/validation/schemas";
import {
  performUniversalSearch,
  type SearchEntity,
} from "~/lib/services/search-service";
import { getRequestAuthContext } from "~/server/auth/context";
import { isError, getErrorMessage } from "~/lib/utils/type-guards";

const UniversalSearchQuerySchema = z.object({
  q: z.string().min(2, "Query must be at least 2 characters"),
  entities: z.string().optional().default("all"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
  sort: z.enum(["relevance", "date"]).optional().default("relevance"),
  order: sortOrderSchema.optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const {
      q: query,
      entities: entitiesParam,
      page,
      limit,
      sort,
      order,
    } = UniversalSearchQuerySchema.parse(queryParams);

    // Parse entities parameter
    const entities: SearchEntity[] =
      entitiesParam === "all"
        ? ["all"]
        : (entitiesParam.split(",").filter(Boolean) as SearchEntity[]);

    // Validate entities
    const validEntities = ["issues", "machines", "users", "locations", "all"];
    const invalidEntities = entities.filter(
      (entity) => !validEntities.includes(entity),
    );
    if (invalidEntities.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid entity types",
          details: `Invalid entities: ${invalidEntities.join(", ")}. Valid entities: ${validEntities.join(", ")}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Canonical auth resolution
    const auth = await getRequestAuthContext();
    if (auth.kind !== "authorized") {
      return NextResponse.json(
        {
          error: "Authentication required",
          message: "Member access required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }
    const organizationId = auth.org.id;

    // Perform universal search
    const searchResponse = await performUniversalSearch({
      query,
      entities,
      organizationId,
      pagination: { page, limit },
      sorting: { field: sort, order: order ?? "desc" },
    });

    return NextResponse.json({
      ...searchResponse,
      query,
      entities: entitiesParam,
      sorting: { field: sort, order: order ?? "desc" },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Universal search error:", error);

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

// Add OPTIONS handler for CORS support
export function OPTIONS(): NextResponse {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  );
}
