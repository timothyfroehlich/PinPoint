"use client";

import * as React from "react";
import { Search, SlidersHorizontal, ChevronDown, X, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { MultiSelect, type Option } from "~/components/mockups/MultiSelect";
import { DateRangePicker } from "~/components/mockups/DateRangePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/ui/badge";

// Sample Data
const statusOptions: Option[] = [
  { label: "New", value: "new" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const machineOptions: Option[] = [
  { label: "Machine A", value: "machine_a" },
  { label: "Machine B", value: "machine_b" },
  { label: "Machine C", value: "machine_c" },
];

const severityOptions: Option[] = [
  { label: "S1 - Critical", value: "s1" },
  { label: "S2 - Major", value: "s2" },
  { label: "S3 - Minor", value: "s3" },
];

const priorityOptions: Option[] = [
  { label: "P1 - Urgent", value: "p1" },
  { label: "P2 - High", value: "p2" },
  { label: "P3 - Normal", value: "p3" },
];

const sortOptions = [
  { label: "Newest First", value: "created_at_desc" },
  { label: "Oldest First", value: "created_at_asc" },
  { label: "Severity: High → Low", value: "severity_desc" },
  { label: "Priority: High → Low", value: "priority_desc" },
];

export default function MockupFiltersPage(): React.JSX.Element {
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [selectedMachines, setSelectedMachines] = React.useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = React.useState<string[]>(
    []
  );
  const [selectedPriorities, setSelectedPriorities] = React.useState<string[]>(
    []
  );
  const [dateRange, setDateRange] = React.useState<{
    from?: Date | undefined;
    to?: Date | undefined;
  }>({});
  const [sortBy, setSortBy] = React.useState("created_at_desc");

  const activeFiltersCount =
    (selectedStatuses.length > 0 ? 1 : 0) +
    (selectedMachines.length > 0 ? 1 : 0) +
    (selectedSeverities.length > 0 ? 1 : 0) +
    (selectedPriorities.length > 0 ? 1 : 0) +
    (dateRange.from ? 1 : 0);

  const clearAll = (): void => {
    setSelectedStatuses([]);
    setSelectedMachines([]);
    setSelectedSeverities([]);
    setSelectedPriorities([]);
    setDateRange({});
    setSearch("");
  };

  return (
    <div className="p-4 flex flex-col gap-4 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 bg-card border rounded-lg p-4 shadow-sm">
        {/* Row 1: Search, Primary Filters, Sort (Desktop) */}
        <div className="flex flex-col md:flex-row gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search issues..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Primary Filters (Desktop) */}
          <div className="hidden lg:flex gap-2 flex-[2]">
            <MultiSelect
              options={statusOptions}
              value={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="Status"
              className="flex-1"
            />
            <MultiSelect
              options={machineOptions}
              value={selectedMachines}
              onChange={setSelectedMachines}
              placeholder="Machine"
              className="flex-1"
            />
            <MultiSelect
              options={severityOptions}
              value={selectedSeverities}
              onChange={setSelectedSeverities}
              placeholder="Severity"
              className="flex-1"
            />
          </div>

          {/* Desktop Sort & More Filters */}
          <div className="flex gap-2 items-center">
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    {sortOptions.find((o) => o.value === sortBy)?.label ??
                      "Sort"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {sortOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className="flex justify-between items-center"
                    >
                      {opt.label}
                      {sortBy === opt.value && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              variant={expanded ? "secondary" : "outline"}
              className="gap-2 shrink-0 relative"
              onClick={() => setExpanded(!expanded)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">More Filters</span>
              {activeFiltersCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearAll}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Secondary / Mobile Filters (Expanded) */}
        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t mt-2">
            {/* These show on mobile regardless, but primary filters from Row 1 move here on mobile */}
            <div className="lg:hidden space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </label>
              <MultiSelect
                options={statusOptions}
                value={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder="Select Status"
              />
            </div>

            <div className="lg:hidden space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Machine
              </label>
              <MultiSelect
                options={machineOptions}
                value={selectedMachines}
                onChange={setSelectedMachines}
                placeholder="Select Machine"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Priority
              </label>
              <MultiSelect
                options={priorityOptions}
                value={selectedPriorities}
                onChange={setSelectedPriorities}
                placeholder="Select Priority"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date Range
              </label>
              <DateRangePicker
                from={dateRange.from}
                to={dateRange.to}
                onChange={(range) => setDateRange(range)}
              />
            </div>

            {/* Placeholder for Advanced filters from spec */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Assignee
              </label>
              <MultiSelect
                options={[]}
                value={[]}
                onChange={() => {
                  // No-op for mockup
                }}
                placeholder="Select Assignee"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Reporter
              </label>
              <MultiSelect
                options={[]}
                value={[]}
                onChange={() => {
                  // No-op for mockup
                }}
                placeholder="Select Reporter"
              />
            </div>
          </div>
        )}
      </div>

      {/* Demo helper */}
      <div className="text-xs text-muted-foreground mt-4 italic space-y-1">
        <p>
          • Resize window to see responsive behavior (Desktop &gt; 1024px,
          Tablet &gt; 640px).
        </p>
        <p>
          • "More Filters" includes Priority, Date Range, and Advanced filters
          on Desktop.
        </p>
        <p>
          • On Mobile, all filters move into the "More Filters" section to save
          space.
        </p>
        <p>
          • Sorting is collapsed into the main row on Desktop, but available via
          "More Filters" or specialized UI on mobile.
        </p>
      </div>
    </div>
  );
}
