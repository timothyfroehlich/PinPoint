import { type Metadata } from "next";
import { notFound } from "next/navigation";
import * as React from "react";

import { LocationDetailView } from "~/components/locations/LocationDetailView";
import { getSupabaseUser } from "~/server/auth/supabase";
import { api } from "~/trpc/server";

interface LocationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: LocationPageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const location = await api.location.getById({ id: resolvedParams.id });

    return {
      title: `${location.name} - PinPoint`,
      description: `View machines and details for ${location.name}`,
      openGraph: {
        title: location.name,
        description: `View machines and details for ${location.name}`,
        type: "article",
      },
    };
  } catch {
    return {
      title: "Location Not Found - PinPoint",
      description: "The requested location could not be found.",
    };
  }
}

export default async function LocationPage({
  params,
}: LocationPageProps): Promise<React.JSX.Element> {
  const user = await getSupabaseUser();

  try {
    // Fetch location data on the server
    const resolvedParams = await params;
    const location = await api.location.getById({ id: resolvedParams.id });

    return (
      <main aria-label="Location details">
        <LocationDetailView
          location={location}
          user={user}
          locationId={resolvedParams.id}
        />
      </main>
    );
  } catch {
    // If location doesn't exist or user doesn't have access, show 404
    notFound();
  }
}
