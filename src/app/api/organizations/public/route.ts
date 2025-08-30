/**
 * Public Organizations API Route
 * Provides organization options for login/signup forms
 * No authentication required - public endpoint
 */

import { NextResponse } from "next/server";
import { getOrganizationSelectOptions } from "~/lib/dal/public-organizations";

export async function GET() {
  try {
    const organizationData = await getOrganizationSelectOptions();
    return NextResponse.json(organizationData);
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}