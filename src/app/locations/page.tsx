import { type Metadata } from "next";
import * as React from "react";

import { LocationList } from "~/components/locations/LocationList";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

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
  const session = await auth();

  try {
    // Use public endpoint for unified dashboard experience
    const locations = await api.location.getPublic();

    return (
      <main aria-label="Locations list">
        <LocationList locations={locations} session={session} />
      </main>
    );
  } catch {
    // Fallback for when organization context is not available
    return (
      <main aria-label="Locations list">
        <LocationList locations={[]} session={session} />
      </main>
    );
  }
}
