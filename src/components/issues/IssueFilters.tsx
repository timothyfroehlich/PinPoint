"use client";

import type React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
// import { cn } from "~/lib/utils"; // Removed unused import

interface MachineOption {
  initials: string;
  name: string;
}

interface IssueFiltersProps {
  machines: MachineOption[];
}

export function IssueFilters({
  machines,
}: IssueFiltersProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentFilters = {
    status: searchParams.get("status"),
    severity: searchParams.get("severity"),
    priority: searchParams.get("priority"),
    machine: searchParams.get("machine"),
  };

  const hasActiveFilters = Object.values(currentFilters).some(Boolean);

  const updateFilter = (key: string, value: string | null): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const clearFilters = (): void => {
    router.push("/issues");
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status Filter */}
      <Select
        value={currentFilters.status ?? "all"}
        onValueChange={(val) => updateFilter("status", val)}
      >
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="new">New</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>

      {/* Severity Filter */}
      <Select
        value={currentFilters.severity ?? "all"}
        onValueChange={(val) => updateFilter("severity", val)}
      >
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severities</SelectItem>
          <SelectItem value="minor">Minor</SelectItem>
          <SelectItem value="playable">Playable</SelectItem>
          <SelectItem value="unplayable">Unplayable</SelectItem>
        </SelectContent>
      </Select>

      {/* Priority Filter */}
      <Select
        value={currentFilters.priority ?? "all"}
        onValueChange={(val) => updateFilter("priority", val)}
      >
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>

      {/* Machine Filter */}
      <Select
        value={currentFilters.machine ?? "all"}
        onValueChange={(val) => updateFilter("machine", val)}
      >
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue placeholder="Machine" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Machines</SelectItem>
          {machines.map((m) => (
            <SelectItem key={m.initials} value={m.initials}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 px-2 text-muted-foreground hover:text-foreground"
          aria-label="Clear filters"
        >
          <X className="mr-1 size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
