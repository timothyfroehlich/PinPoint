import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { performUniversalSearch, type SearchEntity } from "~/lib/services/search-service";
import { requireMemberAccess } from "~/lib/organization-context";

const UniversalSearchQuerySchema = z.object({
  q: z.string().min(2, "Query must be at least 2 characters"),
  entities: z.string().optional().default("all"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
  sort: z.enum(["relevance", "date"]).optional().default("relevance"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
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
      order 
    } = UniversalSearchQuerySchema.parse(queryParams);

    // Parse entities parameter
    const entities: SearchEntity[] = entitiesParam === "all" 
      ? ["all"]
      : entitiesParam.split(",").filter(Boolean) as SearchEntity[];

    // Validate entities
    const validEntities = ["issues", "machines", "users", "locations", "all"];
    const invalidEntities = entities.filter(entity => !validEntities.includes(entity));
    if (invalidEntities.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid entity types",
          details: `Invalid entities: ${invalidEntities.join(", ")}. Valid entities: ${validEntities.join(", ")}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Require authentication and organization context
    const { organization } = await requireMemberAccess();
    const organizationId = organization.id;

    // Perform universal search
    const searchResponse = await performUniversalSearch({
      query,
      entities,
      organizationId,
      pagination: { page, limit },
      sorting: { field: sort, order },
    });

    return NextResponse.json({
      ...searchResponse,
      query,
      entities: entitiesParam,
      sorting: { field: sort, order },
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
        { status: 400 }
      );
    }

    // Handle authentication errors
    if (error instanceof Error && error.message.includes("required")) {
      return NextResponse.json(
        {
          error: "Authentication required",
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
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
    }
  );
}