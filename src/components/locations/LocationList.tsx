/**
 * Placeholder LocationList Component
 * TODO: Implement full location listing functionality
 */

import type { PinPointSupabaseUser, LocationResponse } from "~/lib/types";

// Use canonical Location type to avoid drift
type Location = Pick<LocationResponse, "id" | "name">;

interface LocationListProps {
  locations: Location[];
  user: PinPointSupabaseUser | null;
}

export function LocationList({ locations }: LocationListProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Locations</h1>
        </div>

        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            Location Management Coming Soon
          </h2>
          <p className="text-on-surface-variant mb-4">
            This feature is currently under development.
          </p>
          {locations.length > 0 && (
            <p className="text-sm text-on-surface-variant">
              Found {locations.length} location
              {locations.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
