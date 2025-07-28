"use client";

import { Chip, Box, CircularProgress } from "@mui/material";
import { useMemo } from "react";

import { api } from "~/trpc/react";

interface StatusTogglePillsProps {
  value: string[];
  onChange: (statusIds: string[]) => void;
  showCounts?: boolean;
  parentLoading?: boolean;
}

interface StatusCounts {
  NEW: number;
  IN_PROGRESS: number;
  RESOLVED: number;
}

interface StatusInfo {
  id: string;
  name: string;
  category: "NEW" | "IN_PROGRESS" | "RESOLVED";
}

// Helper function to get status color based on category
const getStatusColor = (
  category: "NEW" | "IN_PROGRESS" | "RESOLVED",
): {
  backgroundColor: string;
  color: string;
} => {
  switch (category) {
    case "NEW":
      return { backgroundColor: "#f44336", color: "white" }; // Red
    case "IN_PROGRESS":
      return { backgroundColor: "#ff9800", color: "white" }; // Orange
    case "RESOLVED":
      return { backgroundColor: "#4caf50", color: "white" }; // Green
  }
};

// Helper function to get readable category labels
const getCategoryLabel = (
  category: "NEW" | "IN_PROGRESS" | "RESOLVED",
): string => {
  switch (category) {
    case "NEW":
      return "Open";
    case "IN_PROGRESS":
      return "In Progress";
    case "RESOLVED":
      return "Closed";
  }
};

export function StatusTogglePills({
  value,
  onChange,
  showCounts = true,
  parentLoading = false,
}: StatusTogglePillsProps): React.JSX.Element {
  const { data: statuses, isLoading: statusesLoading } =
    api.issueStatus.getAll.useQuery();
  const { data: allIssues, isLoading: issuesLoading } =
    api.issue.core.getAll.useQuery();

  // Group statuses by category and calculate counts
  const statusData = useMemo(() => {
    if (!statuses || !allIssues) return null;

    // Group statuses by category
    const statusesByCategory: Record<
      "NEW" | "IN_PROGRESS" | "RESOLVED",
      StatusInfo[]
    > = {
      NEW: [],
      IN_PROGRESS: [],
      RESOLVED: [],
    };

    statuses.forEach((status) => {
      // Only process statuses with valid categories
      if (status.category in statusesByCategory) {
        statusesByCategory[status.category].push(status);
      }
    });

    // Calculate counts by category
    const counts: StatusCounts = {
      NEW: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
    };

    allIssues.forEach((issue) => {
      const category = issue.status.category;
      // Only count issues with valid status categories
      if (category in counts) {
        counts[category]++;
      }
    });

    return { statusesByCategory, counts };
  }, [statuses, allIssues]);

  // Handle category toggle
  const handleCategoryToggle = (
    category: "NEW" | "IN_PROGRESS" | "RESOLVED",
  ): void => {
    if (!statusData) return;

    const categoryStatusIds = statusData.statusesByCategory[category].map(
      (s) => s.id,
    );

    // Check if all statuses in this category are selected
    const allSelected = categoryStatusIds.every((id) => value.includes(id));

    if (allSelected) {
      // Remove all statuses in this category
      onChange(value.filter((id) => !categoryStatusIds.includes(id)));
    } else {
      // Add all statuses in this category (remove duplicates)
      const newValue = [...new Set([...value, ...categoryStatusIds])];
      onChange(newValue);
    }
  };

  // Check if a category is active (has any selected statuses)
  const isCategoryActive = (
    category: "NEW" | "IN_PROGRESS" | "RESOLVED",
  ): boolean => {
    if (!statusData) return false;
    const categoryStatusIds = statusData.statusesByCategory[category].map(
      (s) => s.id,
    );
    return categoryStatusIds.some((id) => value.includes(id));
  };

  // Check if a category is fully selected
  const isCategoryFullySelected = (
    category: "NEW" | "IN_PROGRESS" | "RESOLVED",
  ): boolean => {
    if (!statusData) return false;
    const categoryStatusIds = statusData.statusesByCategory[category].map(
      (s) => s.id,
    );
    return (
      categoryStatusIds.length > 0 &&
      categoryStatusIds.every((id) => value.includes(id))
    );
  };

  if (parentLoading || statusesLoading || issuesLoading || !statusData) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  const categories: ("NEW" | "IN_PROGRESS" | "RESOLVED")[] = [
    "NEW",
    "IN_PROGRESS",
    "RESOLVED",
  ];

  return (
    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
      {categories.map((category) => {
        const isActive = isCategoryActive(category);
        const isFullySelected = isCategoryFullySelected(category);
        const count = statusData.counts[category];
        const colors = getStatusColor(category);
        const label = getCategoryLabel(category);

        return (
          <Chip
            key={category}
            label={showCounts ? `${label} (${count.toString()})` : label}
            onClick={() => {
              handleCategoryToggle(category);
            }}
            variant={isActive ? "filled" : "outlined"}
            sx={{
              backgroundColor: isActive
                ? colors.backgroundColor
                : "transparent",
              color: isActive ? colors.color : colors.backgroundColor,
              borderColor: colors.backgroundColor,
              fontWeight: isFullySelected ? "bold" : "normal",
              opacity: count === 0 ? 0.5 : 1,
              cursor: count === 0 ? "not-allowed" : "pointer",
              "&:hover": {
                backgroundColor: isActive
                  ? colors.backgroundColor
                  : `${colors.backgroundColor}10`,
              },
              "& .MuiChip-label": {
                fontSize: "0.875rem",
              },
            }}
            disabled={count === 0}
          />
        );
      })}
    </Box>
  );
}
