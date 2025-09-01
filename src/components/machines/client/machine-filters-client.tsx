/**
 * Machine Filters Client Island
 * Phase 3B: Location/model filtering with immediate feedback
 * Client Component for interactive filter management and view switching
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  FilterIcon,
  MapPinIcon,
  QrCodeIcon,
  GridIcon,
  ListIcon,
  XIcon,
} from "lucide-react";
import type { MachineFilters } from "~/lib/types";

interface MachineFiltersClientProps {
  locations: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  }[];
  initialFilters: MachineFilters;
  viewMode: "table" | "grid";
}

export function MachineFiltersClient({
  locations,
  initialFilters,
  viewMode,
}: MachineFiltersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    initialFilters.locationIds || [],
  );

  const updateFilters = (
    updates: Partial<{
      locations: string[];
      hasQR: boolean | undefined;
      view: "table" | "grid";
    }>,
  ) => {
    const params = new URLSearchParams(searchParams);

    if (updates.locations !== undefined) {
      if (updates.locations.length > 0) {
        params.set("location", updates.locations.join(","));
      } else {
        params.delete("location");
      }
      setSelectedLocations(updates.locations);
    }

    if (updates.hasQR !== undefined) {
      if (updates.hasQR !== null) {
        params.set("hasQR", String(updates.hasQR));
      } else {
        params.delete("hasQR");
      }
    }

    if (updates.view) {
      if (updates.view !== "table") {
        params.set("view", updates.view);
      } else {
        params.delete("view");
      }
    }

    // Reset to first page when filters change
    params.delete("page");

    startTransition(() => {
      router.push(`/machines?${params.toString()}`);
    });
  };

  const toggleLocation = (locationId: string) => {
    const newSelection = selectedLocations.includes(locationId)
      ? selectedLocations.filter((id) => id !== locationId)
      : [...selectedLocations, locationId];

    updateFilters({ locations: newSelection });
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("location");
    params.delete("model");
    params.delete("owner");
    params.delete("hasQR");
    params.delete("page");

    setSelectedLocations([]);

    startTransition(() => {
      router.push(`/machines?${params.toString()}`);
    });
  };

  const activeFilterCount =
    (initialFilters.locationIds?.length || 0) +
    (initialFilters.modelIds?.length || 0) +
    (initialFilters.ownerIds?.length || 0) +
    (initialFilters.hasQR !== undefined ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      {/* Active Filter Summary */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <FilterIcon className="h-3 w-3" />
            {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 w-6 p-0"
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Location Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            <MapPinIcon className="h-4 w-4 mr-2" />
            Location
            {selectedLocations.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedLocations.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuLabel>Filter by Location</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {locations.map((location) => (
            <DropdownMenuCheckboxItem
              key={location.id}
              checked={selectedLocations.includes(location.id)}
              onCheckedChange={() => {
                toggleLocation(location.id);
              }}
            >
              <div className="flex flex-col">
                <span>{location.name}</span>
                {location.city && (
                  <span className="text-xs text-muted-foreground">
                    {location.city}
                    {location.state && `, ${location.state}`}
                  </span>
                )}
              </div>
            </DropdownMenuCheckboxItem>
          ))}
          {locations.length === 0 && (
            <DropdownMenuItem disabled>No locations available</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* QR Code Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            <QrCodeIcon className="h-4 w-4 mr-2" />
            QR Code
            {initialFilters.hasQR !== undefined && (
              <Badge variant="secondary" className="ml-2">
                1
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Filter by QR Code</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={initialFilters.hasQR === true}
            onCheckedChange={() => {
              updateFilters({
                hasQR: initialFilters.hasQR === true ? undefined : true,
              });
            }}
          >
            Has QR Code
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={initialFilters.hasQR === false}
            onCheckedChange={() => {
              updateFilters({
                hasQR: initialFilters.hasQR === false ? undefined : false,
              });
            }}
          >
            Missing QR Code
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Mode Toggle */}
      <div className="border-l pl-2 ml-2">
        <div className="flex rounded-md border">
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              updateFilters({ view: "table" });
            }}
            className="rounded-r-none border-r"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              updateFilters({ view: "grid" });
            }}
            className="rounded-l-none"
          >
            <GridIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
