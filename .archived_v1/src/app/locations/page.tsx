import { type Metadata } from "next";
import * as React from "react";

import { LocationList } from "~/components/locations/LocationList";
import { getSupabaseUser } from "~/server/auth/supabase";
import { api } from "~/trpc/server";

// Force dynamic rendering for auth-dependent content
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Locations - PinPoint",
  description: "Browse locations and their pinball machines",
  openGraph: {
    title: "Locations - PinPoint",
    description: "Browse locations and their pinball machines",
    type: "website",
  },
};

export default async function LocationsPage(): Promise<React.JSX.Element> {
  const user = await getSupabaseUser();

  try {
    // Use public endpoint for unified dashboard experience
    const locations = await api.location.getPublic();

    return (
      <main aria-label="Locations list">
        <LocationList locations={locations} user={user} />
      </main>
    );
  } catch {
    // Fallback for when organization context is not available
    return (
      <main aria-label="Locations list">
        <LocationList locations={[]} user={user} />
      </main>
    );
  }
}
