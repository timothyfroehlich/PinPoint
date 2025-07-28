"use client";

import { Close } from "@mui/icons-material";
import { Box, Chip, Typography, Button } from "@mui/material";

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

interface ActiveFiltersProps {
  filters: IssueFilters;
  onFiltersChange: (newFilters: Partial<IssueFilters>) => void;
  onClearAll: () => void;
}

export function ActiveFilters({
  filters,
  onFiltersChange,
  onClearAll,
}: ActiveFiltersProps): React.JSX.Element | null {
  // Fetch data for filter display names
  const { data: locations } = api.location.getAll.useQuery();
  const { data: machines } = api.machine.core.getAll.useQuery();
  const { data: statuses } = api.issueStatus.getAll.useQuery();
  const { data: users } = api.user.getAllInOrganization.useQuery();

  // Helper to get display names
  const getLocationName = (id: string): string => {
    const location = locations?.find((l) => l.id === id);
    return location?.name ?? "Unknown Location";
  };

  const getMachineName = (id: string): string => {
    const machine = machines?.find((m) => m.id === id);
    if (!machine) return "Unknown Machine";
    return machine.name !== machine.model.name
      ? `${machine.name} (${machine.model.name})`
      : machine.model.name;
  };

  const getStatusNames = (ids: string[]): string => {
    if (!statuses) return "Unknown Statuses";
    const statusNames = ids
      .map((id) => statuses.find((s) => s.id === id)?.name)
      .filter(Boolean);
    return statusNames.join(", ");
  };

  const getUserName = (id: string): string => {
    if (id === "unassigned") return "Unassigned";
    const user = users?.find((u) => u.id === id);
    return user?.name ?? "Unknown User";
  };

  // Get active filters
  const activeFilters: {
    id: string;
    label: string;
    onRemove: () => void;
  }[] = [];

  if (filters.search) {
    activeFilters.push({
      id: "search",
      label: `Search: "${filters.search}"`,
      onRemove: () => {
        onFiltersChange({ search: undefined });
      },
    });
  }

  if (filters.locationId) {
    activeFilters.push({
      id: "location",
      label: `Location: ${getLocationName(filters.locationId)}`,
      onRemove: () => {
        onFiltersChange({ locationId: undefined });
      },
    });
  }

  if (filters.machineId) {
    activeFilters.push({
      id: "machine",
      label: `Machine: ${getMachineName(filters.machineId)}`,
      onRemove: () => {
        onFiltersChange({ machineId: undefined });
      },
    });
  }

  if (filters.statusIds && filters.statusIds.length > 0) {
    activeFilters.push({
      id: "status",
      label: `Status: ${getStatusNames(filters.statusIds)}`,
      onRemove: () => {
        onFiltersChange({ statusIds: undefined });
      },
    });
  }

  if (filters.assigneeId) {
    activeFilters.push({
      id: "assignee",
      label: `Assignee: ${getUserName(filters.assigneeId)}`,
      onRemove: () => {
        onFiltersChange({ assigneeId: undefined });
      },
    });
  }

  if (filters.reporterId) {
    activeFilters.push({
      id: "reporter",
      label: `Reporter: ${getUserName(filters.reporterId)}`,
      onRemove: () => {
        onFiltersChange({ reporterId: undefined });
      },
    });
  }

  if (filters.ownerId) {
    activeFilters.push({
      id: "owner",
      label: `Owner: ${getUserName(filters.ownerId)}`,
      onRemove: () => {
        onFiltersChange({ ownerId: undefined });
      },
    });
  }

  // Don't show if no active filters
  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          Active Filters ({activeFilters.length})
        </Typography>
        <Button
          size="small"
          onClick={onClearAll}
          sx={{ textTransform: "none", fontSize: "0.75rem" }}
        >
          Clear All
        </Button>
      </Box>
      <Box display="flex" gap={1} flexWrap="wrap">
        {activeFilters.map((filter) => (
          <Chip
            key={filter.id}
            label={filter.label}
            size="small"
            variant="outlined"
            onDelete={filter.onRemove}
            deleteIcon={<Close />}
            sx={{
              "& .MuiChip-label": {
                fontSize: "0.75rem",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
              "& .MuiChip-deleteIcon": {
                fontSize: "1rem",
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
