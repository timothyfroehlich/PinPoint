import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";

import { getGlobalDatabaseProvider } from "~/server/db/provider";

interface PublicOrgRow { id: string; name: string; subdomain: string; logo_url: string | null }

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const db = getGlobalDatabaseProvider().getClient();
    const result = await db.execute(
      sql`SELECT id, name, subdomain, logo_url FROM public_organizations_minimal ORDER BY name`,
    );

    const rows = (result as unknown as { rows: PublicOrgRow[] }).rows;
    const organizations = rows.map((r) => ({ id: r.id, name: r.name, subdomain: r.subdomain }));

    // Prefer APC/test org as default if present, else first
    const apc = organizations.find(
      (o) => o.subdomain === "apc" || o.id === "test-org-pinpoint",
    );
    const defaultOrganizationId = apc?.id ?? organizations[0]?.id ?? null;

    return NextResponse.json({ organizations, defaultOrganizationId });
  } catch (error) {
    console.error("Failed to fetch public organizations:", error);
    return NextResponse.json(
      { organizations: [], defaultOrganizationId: null },
      { status: 200 },
    );
  }
}

