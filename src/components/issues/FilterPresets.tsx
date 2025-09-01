/**
 * Filter Presets Component
 * Quick access buttons for common filtering scenarios
 * Phase 3: Enhanced filtering with preset combinations
 */

"use client";

import { User, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface FilterPreset {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  filters: {
    statusIds?: string[];
    assigneeId?: string;
    search?: string;
    // Add other filter properties as needed
  };
}

interface FilterPresetsProps {
  currentUserId?: string | undefined;
  onPresetClick: (filters: FilterPreset["filters"]) => void;
  activePresetId?: string | undefined;
  className?: string | undefined;
}

export function FilterPresets({
  currentUserId,
  onPresetClick,
  activePresetId,
  className,
}: FilterPresetsProps) {
  // Define preset filter combinations
  const presets: FilterPreset[] = [
    {
      id: "my-issues",
      label: "My Issues",
      icon: <User className="h-4 w-4" />,
      description: "Issues assigned to me",
      filters: {
        ...(currentUserId && { assigneeId: currentUserId }),
        // Note: statusIds would need to be actual status UUIDs, not categories
        // For now, we'll let the component handle status filtering
      },
    },
    {
      id: "urgent",
      label: "Urgent",
      icon: <AlertTriangle className="h-4 w-4" />,
      description: "High priority issues that need attention",
      filters: {
        search: "priority:high", // Use search for complex filters for now
      },
    },
    {
      id: "recent",
      label: "Recent",
      icon: <Clock className="h-4 w-4" />,
      description: "Recently created issues",
      filters: {
        search: "status:new", // Use search-based filtering
      },
    },
    {
      id: "unassigned",
      label: "Unassigned",
      icon: <CheckCircle className="h-4 w-4" />,
      description: "Issues waiting for assignment",
      filters: {
        assigneeId: "unassigned",
      },
    },
  ];

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className="text-sm font-medium text-muted-foreground">
        Quick Filters:
      </span>
      {presets.map((preset) => {
        const isActive = activePresetId === preset.id;

        return (
          <Button
            key={preset.id}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onPresetClick(preset.filters);
            }}
            className={cn(
              "h-8 px-3",
              isActive && "bg-primary text-primary-foreground",
            )}
            title={preset.description}
          >
            <div className="flex items-center gap-2">
              {preset.icon}
              <span>{preset.label}</span>
            </div>
          </Button>
        );
      })}

      {/* Clear All Filters */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onPresetClick({});
        }}
        className="h-8 px-3 text-muted-foreground"
        title="Clear all filters"
      >
        Clear All
      </Button>
    </div>
  );
}
