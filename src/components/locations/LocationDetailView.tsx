/**
 * Placeholder LocationDetailView Component
 * TODO: Implement full location detail functionality
 */

interface Location {
  id: string;
  name: string;
}

interface LocationDetailViewProps {
  location: Location;
}

export function LocationDetailView({ location }: LocationDetailViewProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{location.name}</h1>
        </div>
        
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Location Details Coming Soon
          </h2>
          <p className="text-gray-500 mb-4">
            This feature is currently under development.
          </p>
          <p className="text-sm text-gray-400">
            Location ID: {location.id}
          </p>
        </div>
      </div>
    </div>
  );
}