/**
 * Machine Inventory Server Component
 * Phase 3B: Server-first machine inventory with shadcn/ui table
 * Replaces Material UI DataGrid with performance-optimized server rendering
 */

import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { MapPinIcon, QrCodeIcon, PlusIcon } from "lucide-react";
import { GenericSearch } from "~/components/ui/generic-search";
import { MachineFiltersClient } from "./client/machine-filters-client";
import { PaginationUniversal } from "~/components/ui/pagination-server";
import type { MachineFilters } from "~/lib/types";
import type {
  MachinePagination as MachinePaginationType,
  MachineSorting,
} from "~/lib/dal/machines";

interface MachineInventoryServerProps {
  machines: {
    items: {
      id: string;
      name: string;
      organization_id: string;
      location_id: string;
      model_id: string;
      owner_id: string | null;
      qr_code_id: string | null;
      qr_code_url: string | null;
      qr_code_generated_at: Date | null;
      created_at: Date;
      updated_at: Date;
      location: {
        id: string;
        name: string;
        city: string | null;
        state: string | null;
      } | null;
      model: {
        id: string;
        name: string;
        manufacturer: string | null;
        year: number | null;
      } | null;
    }[];
    totalCount: number;
    hasNextPage: boolean;
    currentPage: number;
    totalPages: number;
  };
  locations: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  }[];
  viewMode: "table" | "grid";
  filters: MachineFilters;
  pagination: MachinePaginationType;
  sorting: MachineSorting;
  searchParams?: Record<string, string | string[] | undefined>;
}

export function MachineInventoryServer({
  machines,
  locations,
  viewMode,
  filters,
  pagination: _pagination,
  sorting: _sorting,
  searchParams,
}: MachineInventoryServerProps): JSX.Element {
  // Empty state
  if (machines.items.length === 0) {
    return (
      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <GenericSearch
              {...(filters.search && { initialSearch: filters.search })}
              basePath="/machines"
              placeholder="Search machines, locations, or models..."
            />
          </div>
          <MachineFiltersClient
            locations={locations}
            initialFilters={filters}
            viewMode={viewMode}
          />
        </div>

        {/* Empty State */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center space-y-4">
              <QrCodeIcon className="h-16 w-16 text-muted-foreground mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">No machines found</h3>
                <p className="text-muted-foreground max-w-md">
                  {filters.search ||
                  filters.locationIds?.length ||
                  filters.modelIds?.length
                    ? "Try adjusting your search criteria or filters."
                    : "Get started by adding your first pinball machine to the inventory."}
                </p>
              </div>
              <Button asChild>
                <Link href="/machines/new">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Machine
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <GenericSearch
            {...(filters.search && { initialSearch: filters.search })}
            basePath="/machines"
            placeholder="Search machines, locations, or models..."
            size="sm"
          />
        </div>
        <MachineFiltersClient
          locations={locations}
          initialFilters={filters}
          viewMode={viewMode}
        />
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-sm">
          {machines.totalCount.toLocaleString()} machine
          {machines.totalCount !== 1 ? "s" : ""}
        </Badge>

        <div className="text-sm text-muted-foreground">
          Page {machines.currentPage} of {machines.totalPages}
        </div>
      </div>

      {/* Machine Display */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {machines.items.map((machine) => (
            <Card
              key={machine.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <Link
                    href={`/machines/${machine.id}`}
                    className="font-medium hover:underline block"
                  >
                    {machine.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {machine.model?.manufacturer} {machine.model?.name}
                    {machine.model?.year && ` (${String(machine.model.year)})`}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPinIcon className="h-3 w-3" />
                  <span className="truncate">
                    {machine.location?.name ?? "Unknown Location"}
                    {machine.location?.city &&
                      `, ${String(machine.location.city)}`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  {machine.qr_code_url ? (
                    <Badge variant="secondary" className="text-xs">
                      <QrCodeIcon className="h-3 w-3 mr-1" />
                      QR Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      No QR Code
                    </Badge>
                  )}

                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/machines/${machine.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.items.map((machine) => (
                <TableRow key={machine.id}>
                  <TableCell className="space-y-1">
                    <Link
                      href={`/machines/${machine.id}`}
                      className="font-medium hover:underline block"
                    >
                      {machine.name}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      Added {machine.created_at.toLocaleDateString()}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPinIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">
                        {machine.location?.name ?? "Unknown"}
                      </span>
                    </div>
                    {machine.location?.city && (
                      <div className="text-sm text-muted-foreground">
                        {machine.location.city}
                        {machine.location.state &&
                          `, ${machine.location.state}`}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {machine.model?.name ?? "Unknown Model"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {machine.model?.manufacturer}
                        {machine.model?.year &&
                          ` (${String(machine.model.year)})`}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {machine.qr_code_url ? (
                      <Badge variant="secondary">
                        <QrCodeIcon className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not Generated</Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/machines/${machine.id}`}>View</Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/machines/${machine.id}/edit`}>Edit</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      <PaginationUniversal
        currentPage={machines.currentPage}
        totalPages={machines.totalPages}
        totalCount={machines.totalCount}
        baseUrl="/machines"
        itemName="machines"
        {...(searchParams && { searchParams })}
      />
    </div>
  );
}
