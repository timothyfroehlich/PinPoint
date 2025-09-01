/**
 * Placeholder LocationDetailView Component
 * TODO: Implement full location detail functionality
 */

import type { PinPointSupabaseUser, LocationResponse } from "~/lib/types";

// Use canonical Location type to avoid drift
type Location = Pick<LocationResponse, "id" | "name">;

interface LocationDetailViewProps {
  location: Location;
  user: PinPointSupabaseUser | null;
  locationId: string;
}

export function LocationDetailView({ location, user: _user, locationId: _locationId }: LocationDetailViewProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{location.name}</h1>
        </div>
        
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            Location Details Coming Soon
          </h2>
          <p className="text-on-surface-variant mb-4">
            This feature is currently under development.
          </p>
          <p className="text-sm text-on-surface-variant">
            Location ID: {location.id}
          </p>
        </div>
      </div>
    </div>
  );
}
