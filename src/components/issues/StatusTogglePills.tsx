"use client";

import { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Loader2 } from "lucide-react";

import { api } from "~/trpc/react";

interface StatusTogglePillsProps {
  value: string[];
  onChange: (statusIds: string[]) => void;
  showCounts?: boolean;
  parentLoading?: boolean;
}

interface StatusInfo {
  id: string;
  name: string;
  category: "NEW" | "IN_PROGRESS" | "RESOLVED";
}

// Status color mapping is now handled inline with Tailwind classes

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
}: StatusTogglePillsProps): JSX.Element {
  // Use optimized endpoint that returns category-based counts directly
  const { data: statusCounts, isLoading: countsLoading } =
    api.issueStatus.getStatusCounts.useQuery();
  const { data: statuses, isLoading: statusesLoading } =
    api.issueStatus.getAll.useQuery();

  // Group statuses by category for toggle functionality
  const statusesByCategory = useMemo(() => {
    if (!statuses) return null;

    const grouped: Record<"NEW" | "IN_PROGRESS" | "RESOLVED", StatusInfo[]> = {
      NEW: [],
      IN_PROGRESS: [],
      RESOLVED: [],
    };

    statuses.forEach((status: StatusInfo): void => {
      // Only process statuses with valid categories
      if (status.category in grouped) {
        grouped[status.category].push(status);
      }
    });

    return grouped;
  }, [statuses]);

  // Handle category toggle
  const handleCategoryToggle = (
    category: "NEW" | "IN_PROGRESS" | "RESOLVED",
  ): void => {
    if (!statusesByCategory) return;

    // eslint-disable-next-line security/detect-object-injection -- category is type-constrained to union type
    const categoryStatusIds = statusesByCategory[category].map(
      (s): string => s.id,
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
    if (!statusesByCategory) return false;
    // eslint-disable-next-line security/detect-object-injection -- category is type-constrained to union type
    const categoryStatusIds = statusesByCategory[category].map(
      (s): string => s.id,
    );
    return categoryStatusIds.some((id) => value.includes(id));
  };

  // Check if a category is fully selected
  const isCategoryFullySelected = (
    category: "NEW" | "IN_PROGRESS" | "RESOLVED",
  ): boolean => {
    if (!statusesByCategory) return false;
    // eslint-disable-next-line security/detect-object-injection -- category is type-constrained to union type
    const categoryStatusIds = statusesByCategory[category].map(
      (s): string => s.id,
    );
    return (
      categoryStatusIds.length > 0 &&
      categoryStatusIds.every((id) => value.includes(id))
    );
  };

  if (
    parentLoading ||
    statusesLoading ||
    countsLoading ||
    !statusesByCategory ||
    !statusCounts
  ) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const categories: ("NEW" | "IN_PROGRESS" | "RESOLVED")[] = [
    "NEW",
    "IN_PROGRESS",
    "RESOLVED",
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {categories.map((category): JSX.Element => {
        const isActive = isCategoryActive(category);
        const isFullySelected = isCategoryFullySelected(category);
        // eslint-disable-next-line security/detect-object-injection -- category is type-constrained to union type
        const count = statusCounts[category];
        const label = getCategoryLabel(category);

        // Get status color classes using Material 3 semantic colors
        const getStatusClasses = (
          category: "NEW" | "IN_PROGRESS" | "RESOLVED",
          isActive: boolean,
        ): string => {
          const baseClasses = "text-sm font-normal transition-all duration-200";

          switch (category) {
            case "NEW":
              return cn(
                baseClasses,
                isActive
                  ? "bg-error text-on-error border-error hover:bg-error/90"
                  : "text-error border-error bg-transparent hover:bg-error/10",
              );
            case "IN_PROGRESS":
              return cn(
                baseClasses,
                isActive
                  ? "bg-secondary text-on-secondary border-secondary hover:bg-secondary/90"
                  : "text-secondary border-secondary bg-transparent hover:bg-secondary/10",
              );
            case "RESOLVED":
              return cn(
                baseClasses,
                isActive
                  ? "bg-tertiary text-on-tertiary border-tertiary hover:bg-tertiary/90"
                  : "text-tertiary border-tertiary bg-transparent hover:bg-tertiary/10",
              );
          }
        };

        return (
          <Button
            key={category}
            variant="outline"
            size="sm"
            onClick={(): void => {
              handleCategoryToggle(category);
            }}
            disabled={count === 0}
            className={cn(
              getStatusClasses(category, isActive),
              isFullySelected && "font-semibold",
              count === 0 && "opacity-50 cursor-not-allowed",
              "h-8 px-3",
            )}
          >
            <span>{label}</span>
            {showCounts && (
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 h-5 px-1.5 text-xs",
                  isActive
                    ? "bg-surface-variant/20 text-on-surface"
                    : "bg-current/10 text-current",
                )}
              >
                {count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
