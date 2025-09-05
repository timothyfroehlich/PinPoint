"use client";

import { ChevronDown, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { ISSUE_SORT_OPTIONS } from "~/lib/types/filters";

import { AdvancedFiltersDropdown } from "./AdvancedFiltersDropdown";
import { MachineFilterDropdown } from "./MachineFilterDropdown";
import { FilteredSearch } from "~/components/ui/filtered-search";
import { StatusTogglePills } from "./StatusTogglePills";
import { FilterPresets } from "./FilterPresets";

import { api } from "~/trpc/react";

interface IssueFilters {
  locationId?: string | undefined;
  machineId?: string | undefined;
  statusIds?: string[] | undefined;
  search?: string | undefined;
  assigneeId?: string | undefined;
  reporterId?: string | undefined;
  ownerId?: string | undefined;
  sortBy: (typeof ISSUE_SORT_OPTIONS)[number];
  sortOrder: "asc" | "desc";
}

interface FilterToolbarProps {
  filters: IssueFilters;
  onFiltersChange: (newFilters: Partial<IssueFilters>) => void;
  isLoading?: boolean;
}

export function FilterToolbar({
  filters,
  onFiltersChange,
  isLoading = false,
}: FilterToolbarProps): JSX.Element {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string>();

  // Fetch locations for filter dropdown
  const { data: locations } = api.location.getAll.useQuery();

  // Get current user for "My Issues" preset
  const { data: currentUser } = api.user.getProfile.useQuery();

  const handleSortOrderToggle = (): void => {
    onFiltersChange({
      sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
    });
  };

  const handlePresetClick = (
    presetFilters: Partial<IssueFilters>,
    presetId?: string,
  ): void => {
    // Apply preset filters and mark which preset is active
    onFiltersChange({
      ...filters,
      ...presetFilters,
      // Reset other filters when applying preset
      ...(Object.keys(presetFilters).length === 0 && {
        assigneeId: undefined,
        search: undefined,
        statusIds: undefined,
      }),
    });
    setActivePresetId(presetId);
  };

  return (
    <Card className="p-4 mb-6 border">
      {/* Filter Presets Row */}
      <div className="mb-4">
        <FilterPresets
          currentUserId={currentUser?.id}
          onPresetClick={(presetFilters) => {
            handlePresetClick(presetFilters);
          }}
          activePresetId={activePresetId}
        />
      </div>

      {/* Primary Filter Row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search - Most prominent */}
        <div className="flex-grow min-w-[250px]">
          <FilteredSearch
            value={filters.search ?? ""}
            onChange={(search) => {
              onFiltersChange({ search: search === "" ? undefined : search });
            }}
            placeholder="Search issues..."
          />
        </div>

        {/* Status Pills - Primary filter */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Status:
          </Label>
          <StatusTogglePills
            value={filters.statusIds ?? []}
            onChange={(statusIds: string[]) => {
              onFiltersChange({ statusIds });
            }}
            parentLoading={isLoading}
          />
        </div>

        {/* Machine Filter - Primary */}
        <MachineFilterDropdown
          value={filters.machineId ?? ""}
          onChange={(machineId) => {
            onFiltersChange({
              machineId: machineId === "" ? undefined : machineId,
            });
          }}
        />

        {/* Advanced Filters Toggle */}
        <div className="flex items-center gap-2">
          <AdvancedFiltersDropdown
            assigneeId={filters.assigneeId ?? ""}
            reporterId={filters.reporterId ?? ""}
            ownerId={filters.ownerId ?? ""}
            onAssigneeChange={(assigneeId) => {
              onFiltersChange({
                assigneeId: assigneeId === "" ? undefined : assigneeId,
              });
            }}
            onReporterChange={(reporterId) => {
              onFiltersChange({
                reporterId: reporterId === "" ? undefined : reporterId,
              });
            }}
            onOwnerChange={(ownerId) => {
              onFiltersChange({
                ownerId: ownerId === "" ? undefined : ownerId,
              });
            }}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAdvanced(!showAdvanced);
            }}
            aria-label={
              showAdvanced ? "Hide advanced filters" : "Show advanced filters"
            }
            className={cn(
              "h-8 w-8 p-0 transition-all duration-200",
              showAdvanced && "text-primary",
            )}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                showAdvanced && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>

      {/* Secondary Filters - Collapsible */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t flex items-center gap-4 flex-wrap">
          {/* Location Filter */}
          <div className="min-w-[150px]">
            <Select
              value={filters.locationId ?? ""}
              onValueChange={(value) => {
                onFiltersChange({
                  locationId: value === "" ? undefined : value,
                });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Locations</SelectItem>
                {locations?.map((location: { id: string; name: string }) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <div className="min-w-[130px]">
              <Select
                value={filters.sortBy}
                onValueChange={(value) => {
                  onFiltersChange({
                    sortBy: value as IssueFilters["sortBy"],
                  });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_SORT_OPTIONS.map((option) => {
                    const labels = {
                      created: "Created Date",
                      updated: "Updated Date",
                      status: "Status",
                      severity: "Priority",
                      machine: "Machine",
                    } as const;
                    const label = Object.prototype.hasOwnProperty.call(
                      labels,
                      option,
                    )
                      ? labels[option]
                      : option;
                    return (
                      <SelectItem key={option} value={option}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSortOrderToggle}
                    className={cn(
                      "h-8 w-8 p-0 transition-all duration-200",
                      filters.sortOrder === "desc" && "text-primary",
                    )}
                  >
                    <ArrowUpDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        filters.sortOrder === "desc" && "rotate-180",
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Sort{" "}
                    {filters.sortOrder === "asc" ? "Ascending" : "Descending"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}
    </Card>
  );
}
