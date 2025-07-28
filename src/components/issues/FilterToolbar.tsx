"use client";

import { ExpandMore, SwapVert } from "@mui/icons-material";
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { useState } from "react";

import { AdvancedFiltersDropdown } from "./AdvancedFiltersDropdown";
import { GameFilterDropdown } from "./GameFilterDropdown";
import { SearchTextField } from "./SearchTextField";
import { StatusTogglePills } from "./StatusTogglePills";

import { api } from "~/trpc/react";

interface IssueFilters {
  locationId?: string | undefined;
  machineId?: string | undefined;
  statusIds?: string[] | undefined;
  search?: string | undefined;
  assigneeId?: string | undefined;
  reporterId?: string | undefined;
  ownerId?: string | undefined;
  sortBy: "created" | "updated" | "status" | "severity" | "game";
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
}: FilterToolbarProps): React.JSX.Element {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch locations for filter dropdown
  const { data: locations } = api.location.getAll.useQuery();

  const handleSortOrderToggle = (): void => {
    onFiltersChange({
      sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
    });
  };

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Primary Filter Row */}
      <Box
        display="flex"
        alignItems="center"
        gap={2}
        flexWrap="wrap"
        sx={{
          "& > *": {
            minWidth: { xs: "100%", sm: "auto" },
          },
        }}
      >
        {/* Search - Most prominent */}
        <Box sx={{ flexGrow: 1, minWidth: 250 }}>
          <SearchTextField
            value={filters.search ?? ""}
            onChange={(search) => {
              onFiltersChange({ search: search === "" ? undefined : search });
            }}
          />
        </Box>

        {/* Status Pills - Primary filter */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.75rem", fontWeight: 500 }}
          >
            Status:
          </Typography>
          <StatusTogglePills
            value={filters.statusIds ?? []}
            onChange={(statusIds: string[]) => {
              onFiltersChange({ statusIds });
            }}
            parentLoading={isLoading}
          />
        </Box>

        {/* Machine Filter - Primary */}
        <GameFilterDropdown
          value={filters.machineId ?? ""}
          onChange={(machineId) => {
            onFiltersChange({
              machineId: machineId === "" ? undefined : machineId,
            });
          }}
        />

        {/* Advanced Filters Toggle */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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

          <IconButton
            size="small"
            onClick={() => {
              setShowAdvanced(!showAdvanced);
            }}
            aria-label={
              showAdvanced ? "Hide advanced filters" : "Show advanced filters"
            }
            sx={{
              color: showAdvanced ? "primary.main" : "text.secondary",
              transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)",
              transition: "all 0.2s ease-in-out",
            }}
          >
            <ExpandMore />
          </IconButton>
        </Box>
      </Box>

      {/* Secondary Filters - Collapsible */}
      {showAdvanced && (
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          {/* Location Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="location-filter-label">Location</InputLabel>
            <Select
              labelId="location-filter-label"
              value={filters.locationId ?? ""}
              onChange={(e: SelectChangeEvent) => {
                const value = e.target.value;
                onFiltersChange({
                  locationId: value === "" ? undefined : value,
                });
              }}
              label="Location"
            >
              <MenuItem value="">All Locations</MenuItem>
              {locations?.map((location: { id: string; name: string }) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sort Controls */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="sort-by-filter-label">Sort By</InputLabel>
              <Select
                labelId="sort-by-filter-label"
                value={filters.sortBy}
                onChange={(e: SelectChangeEvent) => {
                  onFiltersChange({
                    sortBy: e.target.value as IssueFilters["sortBy"],
                  });
                }}
                label="Sort By"
              >
                <MenuItem value="created">Created Date</MenuItem>
                <MenuItem value="updated">Updated Date</MenuItem>
                <MenuItem value="status">Status</MenuItem>
                <MenuItem value="severity">Priority</MenuItem>
                <MenuItem value="game">Game</MenuItem>
              </Select>
            </FormControl>

            <Tooltip
              title={`Sort ${
                filters.sortOrder === "asc" ? "Ascending" : "Descending"
              }`}
            >
              <IconButton
                size="small"
                onClick={handleSortOrderToggle}
                sx={{
                  color:
                    filters.sortOrder === "desc" ? "primary.main" : "inherit",
                  transform:
                    filters.sortOrder === "desc"
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <SwapVert />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
