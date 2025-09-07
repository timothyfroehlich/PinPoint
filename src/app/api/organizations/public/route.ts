import { NextResponse, type NextRequest } from "next/server";
import { getAllOrganizationsForLogin } from "~/lib/dal/public-organizations";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const organizations = await getAllOrganizationsForLogin();

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
