"use client";

import * as React from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  Activity,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { MultiSelect, type Option } from "~/components/mockups/MultiSelect";
import { DateRangePicker } from "~/components/mockups/DateRangePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import {
  STATUS_CONFIG,
  STATUS_GROUPS,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
} from "~/lib/issues/status";

// Sample Data derived from canonical config
const statusGroups = [
  {
    label: "New",
    options: STATUS_GROUPS.new.map((s) => ({
      label: STATUS_CONFIG[s].label,
      value: s,
    })),
  },
  {
    label: "In Progress",
    options: STATUS_GROUPS.in_progress.map((s) => ({
      label: STATUS_CONFIG[s].label,
      value: s,
    })),
  },
  {
    label: "Closed",
    options: STATUS_GROUPS.closed.map((s) => ({
      label: STATUS_CONFIG[s].label,
      value: s,
    })),
  },
];

const machineOptions: Option[] = [
  { label: "Attack from Mars", value: "AFM", badgeLabel: "AFM" },
  { label: "Twilight Zone", value: "TZ", badgeLabel: "TZ" },
  { label: "Medieval Madness", value: "MM", badgeLabel: "MM" },
  { label: "Monster Bash", value: "MB", badgeLabel: "MB" },
  { label: "Cirqus Voltaire", value: "CV", badgeLabel: "CV" },
  { label: "Tales of Arabian Nights", value: "TOTAN", badgeLabel: "TOTAN" },
  { label: "Hot Tip", value: "HOTTIP", badgeLabel: "HOTTIP" },
];

const severityOptions: Option[] = Object.entries(SEVERITY_CONFIG).map(
  ([value, config]) => ({
    label: config.label,
    value,
  })
);

const priorityOptions: Option[] = Object.entries(PRIORITY_CONFIG).map(
  ([value, config]) => ({
    label: config.label,
    value,
  })
);

import {
  IssueList,
  type MockIssue,
  type SortDirection,
} from "~/components/mockups/IssueList";

const assigneeOptions: Option[] = [
  { label: "Tim F.", value: "Tim F." },
  { label: "Ryan C.", value: "Ryan C." },
  { label: "John D.", value: "John D." },
];

// Generate 10 High-Fidelity Mock Issues with realistic IDs
const MOCK_ISSUES: MockIssue[] = [
  {
    id: "101",
    title: "Playfield light flickering near left flipper",
    status: "new",
    priority: "high",
    severity: "major",
    machine: "AFM",
    machineLabel: "Attack from Mars",
    assignee: "Tim F.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    id: "102",
    title: "DMD display showing garbled characters intermittently",
    status: "in_progress",
    priority: "high",
    severity: "unplayable",
    machine: "TZ",
    machineLabel: "Twilight Zone",
    assignee: "Ryan C.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
  },
  {
    id: "103",
    title: "Right slingshot not firing in test mode",
    status: "need_parts",
    priority: "medium",
    severity: "major",
    machine: "MM",
    machineLabel: "Medieval Madness",
    assignee: "John D.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
  {
    id: "104",
    title: "Cabinet decal peeling on right side",
    status: "confirmed",
    priority: "low",
    severity: "cosmetic",
    machine: "MB",
    machineLabel: "Monster Bash",
    assignee: undefined,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
  },
  {
    id: "105",
    title: "Autoplunger weak, failing to clear ramp",
    status: "need_help",
    priority: "high",
    severity: "major",
    machine: "CV",
    machineLabel: "Cirqus Voltaire",
    assignee: "Tim F.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
  },
  {
    id: "106",
    title: "Sound crackling at high volumes",
    status: "new",
    priority: "medium",
    severity: "minor",
    machine: "TOTAN",
    machineLabel: "Tales of Arabian Nights",
    assignee: "Ryan C.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
  },
  {
    id: "107",
    title: "Left outlane switch non-responsive",
    status: "wait_owner",
    priority: "low",
    severity: "minor",
    machine: "HOTTIP",
    machineLabel: "Hot Tip",
    assignee: "John D.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  },
  {
    id: "108",
    title: "Lock bar latch loose",
    status: "fixed",
    priority: "medium",
    severity: "cosmetic",
    machine: "TZ",
    machineLabel: "Twilight Zone",
    assignee: "Tim F.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "109",
    title: "Ball stuck in trough 3 consistently",
    status: "in_progress",
    priority: "high",
    severity: "unplayable",
    machine: "MM",
    machineLabel: "Medieval Madness",
    assignee: "Ryan C.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
  },
  {
    id: "110",
    title: "Backbox hinges squeaky",
    status: "no_repro",
    priority: "low",
    severity: "cosmetic",
    machine: "MB",
    machineLabel: "Monster Bash",
    assignee: undefined,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
  },
  {
    id: "111",
    title: "Upper playfield diverter sticking",
    status: "new",
    priority: "high",
    severity: "major",
    machine: "TZ",
    machineLabel: "Twilight Zone",
    assignee: "Ryan C.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
  },
  {
    id: "112",
    title: "Coin mech jammed with token",
    status: "confirmed",
    priority: "medium",
    severity: "minor",
    machine: "AFM",
    machineLabel: "Attack from Mars",
    assignee: "Tim F.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    id: "113",
    title: "Lower pop bumper fuse blowing",
    status: "in_progress",
    priority: "high",
    severity: "major",
    machine: "MM",
    machineLabel: "Medieval Madness",
    assignee: "John D.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
  },
  {
    id: "114",
    title: "Skill shot optics misaligned",
    status: "need_parts",
    priority: "medium",
    severity: "major",
    machine: "CV",
    machineLabel: "Cirqus Voltaire",
    assignee: "Ryan C.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    id: "115",
    title: "Translator board loose connection",
    status: "new",
    priority: "low",
    severity: "minor",
    machine: "TOTAN",
    machineLabel: "Tales of Arabian Nights",
    assignee: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function MockupFiltersPage(): React.JSX.Element {
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const searchBarRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [visibleBadgeCount, setVisibleBadgeCount] = React.useState(Infinity);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [selectedMachines, setSelectedMachines] = React.useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = React.useState<string[]>(
    []
  );
  const [selectedPriorities, setSelectedPriorities] = React.useState<string[]>(
    []
  );
  const [selectedAssignees, setSelectedAssignees] = React.useState<string[]>(
    []
  );
  const [selectedReporters, setSelectedReporters] = React.useState<string[]>(
    []
  );
  const [selectedOwners, setSelectedOwners] = React.useState<string[]>([]);
  const [selectedConsistencies, setSelectedConsistencies] = React.useState<
    string[]
  >([]);
  const [dateRange, setDateRange] = React.useState<{
    from?: Date | undefined;
    to?: Date | undefined;
  }>({});

  // Pagination State
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const [sortState, setSortState] = React.useState<{
    column: keyof MockIssue | null;
    direction: SortDirection;
  }>({ column: "updatedAt", direction: "desc" });

  const clearAll = (): void => {
    setSelectedStatuses([]);
    setSelectedMachines([]);
    setSelectedSeverities([]);
    setSelectedPriorities([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setSelectedOwners([]);
    setSelectedConsistencies([]);
    setDateRange({});
    setSearch("");
  };

  const handleSort = (column: keyof MockIssue): void => {
    setSortState((prev) => {
      if (prev.column === column) {
        if (prev.direction === "desc") return { column, direction: "asc" };
        if (prev.direction === "asc") return { column: null, direction: null };
      }
      return { column, direction: "desc" };
    });
  };

  const filteredIssues = React.useMemo(() => {
    let result = [...MOCK_ISSUES];

    // Search Filter
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(s) || i.id.toLowerCase().includes(s)
      );
    }

    // Status Filter
    if (selectedStatuses.length > 0) {
      result = result.filter((i) => selectedStatuses.includes(i.status));
    }

    // Machine Filter
    if (selectedMachines.length > 0) {
      result = result.filter((i) => selectedMachines.includes(i.machine));
    }

    // Severity Filter
    if (selectedSeverities.length > 0) {
      result = result.filter((i) => selectedSeverities.includes(i.severity));
    }

    // Priority Filter
    if (selectedPriorities.length > 0) {
      result = result.filter((i) => selectedPriorities.includes(i.priority));
    }

    // Assignee Filter
    if (selectedAssignees.length > 0) {
      result = result.filter((i) =>
        i.assignee ? selectedAssignees.includes(i.assignee) : false
      );
    }

    // Sort logic
    result.sort((a, b) => {
      if (sortState.column) {
        const aVal = a[sortState.column];
        const bVal = b[sortState.column];

        if (aVal !== bVal) {
          if (aVal === undefined) return 1;
          if (bVal === undefined) return -1;

          const modifier = sortState.direction === "asc" ? 1 : -1;
          if (aVal < bVal) return -1 * modifier;
          if (aVal > bVal) return 1 * modifier;
        }
      }

      // Secondary sort: updatedAt desc
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return result;
  }, [
    search,
    sortState,
    selectedStatuses,
    selectedMachines,
    selectedSeverities,
    selectedPriorities,
    selectedAssignees,
  ]);

  // Text Width Measurement
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [textWidth, setTextWidth] = React.useState(0);

  React.useEffect(() => {
    if (measureRef.current) {
      // Use getBoundingClientRect for more precision
      setTextWidth(measureRef.current.getBoundingClientRect().width);
    }
  }, [search]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    selectedStatuses,
    selectedMachines,
    selectedSeverities,
    selectedPriorities,
    selectedAssignees,
    dateRange,
  ]);

  // Badge Logic
  const getBadges = (): {
    id: string;
    label: string;
    clear: () => void;
  }[] => {
    const badges: {
      id: string;
      label: string;
      clear: () => void;
    }[] = [];

    // Machines
    selectedMachines.forEach((m) => {
      const label =
        machineOptions.find((opt) => opt.value === m)?.badgeLabel ?? m;
      badges.push({
        id: `machine-${m}`,
        label: label,
        clear: () => setSelectedMachines((prev) => prev.filter((v) => v !== m)),
      });
    });

    // Status: Check for groups first
    let remainingStatuses = [...selectedStatuses];

    // Check New Group
    const newGroupIds = STATUS_GROUPS.new;
    const hasAllNew = newGroupIds.every((s) => remainingStatuses.includes(s));
    if (hasAllNew) {
      badges.push({
        id: "status-group-new",
        label: "Status: New",
        clear: () =>
          setSelectedStatuses((prev) =>
            prev.filter(
              (v) => !newGroupIds.includes(v as (typeof newGroupIds)[number])
            )
          ),
      });
      remainingStatuses = remainingStatuses.filter(
        (s) => !newGroupIds.includes(s as (typeof newGroupIds)[number])
      );
    }

    // Check In Progress Group
    const inProgressIds = STATUS_GROUPS.in_progress;
    const hasAllInProgress = inProgressIds.every((s) =>
      remainingStatuses.includes(s)
    );
    if (hasAllInProgress) {
      badges.push({
        id: "status-group-inprogress",
        label: "Status: In Progress",
        clear: () =>
          setSelectedStatuses((prev) =>
            prev.filter(
              (v) =>
                !inProgressIds.includes(v as (typeof inProgressIds)[number])
            )
          ),
      });
      remainingStatuses = remainingStatuses.filter(
        (s) => !inProgressIds.includes(s as (typeof inProgressIds)[number])
      );
    }

    // Check Closed Group
    const closedIds = STATUS_GROUPS.closed;
    const hasAllClosed = closedIds.every((s) => remainingStatuses.includes(s));
    if (hasAllClosed) {
      badges.push({
        id: "status-group-closed",
        label: "Status: Closed",
        clear: () =>
          setSelectedStatuses((prev) =>
            prev.filter(
              (v) => !closedIds.includes(v as (typeof closedIds)[number])
            )
          ),
      });
      remainingStatuses = remainingStatuses.filter(
        (s) => !closedIds.includes(s as (typeof closedIds)[number])
      );
    }

    // Remaining Statuses
    remainingStatuses.forEach((s) => {
      badges.push({
        id: `status-${s}`,
        label:
          (STATUS_CONFIG as Record<string, { label: string }>)[s]?.label ?? s,
        clear: () => setSelectedStatuses((prev) => prev.filter((v) => v !== s)),
      });
    });

    // Severity
    selectedSeverities.forEach((s) => {
      badges.push({
        id: `severity-${s}`,
        label:
          (SEVERITY_CONFIG as Record<string, { label: string }>)[s]?.label ?? s,
        clear: () =>
          setSelectedSeverities((prev) => prev.filter((v) => v !== s)),
      });
    });

    // Priority
    selectedPriorities.forEach((p) => {
      badges.push({
        id: `priority-${p}`,
        label:
          (PRIORITY_CONFIG as Record<string, { label: string }>)[p]?.label ?? p,
        clear: () =>
          setSelectedPriorities((prev) => prev.filter((v) => v !== p)),
      });
    });

    // Assignee
    selectedAssignees.forEach((a) => {
      badges.push({
        id: `assignee-${a}`,
        label: a,
        clear: () =>
          setSelectedAssignees((prev) => prev.filter((v) => v !== a)),
      });
    });

    // Other filters...
    if (dateRange.from) {
      badges.push({
        id: "date",
        label: "Date Range",
        clear: () => setDateRange({}),
      });
    }

    return badges;
  };

  const badgeList = getBadges();
  const totalActive =
    selectedStatuses.length +
    selectedMachines.length +
    selectedSeverities.length +
    selectedPriorities.length +
    selectedAssignees.length +
    selectedOwners.length +
    selectedReporters.length +
    selectedConsistencies.length +
    (dateRange.from ? 1 : 0);

  // Layout State
  // const [inputWidth, setInputWidth] = React.useState<string>("33%");

  const [badgeAreaWidth, setBadgeAreaWidth] = React.useState(0);

  // Calculate visible badges based on text collision and update input padding
  React.useEffect(() => {
    if (!searchBarRef.current) return;

    const calculateLayout = (): void => {
      window.requestAnimationFrame(() => {
        if (!searchBarRef.current) return;

        const containerWidth = searchBarRef.current.offsetWidth;
        if (containerWidth === 0) return;

        if (badgeList.length === 0) {
          setVisibleBadgeCount(0);
          return;
        }

        // Constants
        const leftPadding = 12; // px-3 left
        const rightPadding = 12; // px-3 right
        const iconWidth = 16; // search icon
        const iconGap = 8; // gap after icon
        const plusBadgeWidth = 36; // Reserved for "+X"
        const textBuffer = 6; // Space after text before collision

        // Calculate where the text starts and ends
        const textStartPosition = leftPadding + iconWidth + iconGap;
        const textEndPosition = textStartPosition + textWidth + textBuffer;

        // Calculate available space for badges on the right
        // Badges are positioned with right-3 (12px from right edge)
        const badgeAreaRightEdge = containerWidth - rightPadding;
        const maxBadgeSpace = badgeAreaRightEdge - textEndPosition;

        // Estimate badge widths
        const badgeGap = 6;
        const badgeWidths = badgeList.map((b) => b.label.length * 7.5 + 34);

        // Check if all badges fit
        let totalNeeded = badgeWidths.reduce((a, b) => a + b + badgeGap, 0);
        if (badgeWidths.length > 0) totalNeeded -= badgeGap;

        if (totalNeeded <= maxBadgeSpace) {
          // All fit, show everything
          setVisibleBadgeCount(badgeList.length);
          return;
        }

        // Some don't fit. Reserve space for +X and fit what we can.
        const spaceForVisible = Math.max(
          0,
          maxBadgeSpace - plusBadgeWidth - badgeGap
        );

        let used = 0;
        let count = 0;
        for (const w of badgeWidths) {
          if (used + w <= spaceForVisible) {
            used += w + badgeGap;
            count++;
          } else {
            break;
          }
        }

        setVisibleBadgeCount(count);

        // Calculate total width of visible badges + +X badge (if shown) + gaps for input padding
        const visibleBadgeWidth = badgeWidths
          .slice(0, count)
          .reduce((a, b) => a + b + badgeGap, 0);
        const hasOverflow = count < badgeList.length;
        const totalBadgeAreaWidth =
          visibleBadgeWidth + (hasOverflow ? plusBadgeWidth + badgeGap : 0);
        setBadgeAreaWidth(totalBadgeAreaWidth); // Removed safety margin to reduce dead space
      });
    };

    calculateLayout();

    const resizeObserver = new ResizeObserver(calculateLayout);
    resizeObserver.observe(searchBarRef.current);

    return () => resizeObserver.disconnect();
  }, [badgeList, textWidth, totalActive]);

  const visibleBadges = badgeList.slice(0, visibleBadgeCount);
  const hiddenBadgeCount = badgeList.length - visibleBadgeCount;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-7xl mx-auto">
      <div className="bg-card border rounded-lg shadow-sm divide-y">
        {/* Row 1: Integrated Search Bar (Full-width) */}
        <div className="p-3">
          <div className="flex items-center gap-2">
            <div
              ref={searchBarRef}
              className={cn(
                "flex items-center gap-2 px-3 h-11 bg-background border rounded-md transition-all shadow-sm ring-offset-background flex-1 relative",
                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:border-ring/30"
              )}
            >
              <Search className="h-4 w-4 text-muted-foreground shrink-0 relative z-10" />

              {/* Hidden text measurement span */}
              <span
                ref={measureRef}
                className="absolute invisible whitespace-pre pointer-events-none"
                style={{
                  left: "36px",
                  fontFamily: "inherit",
                  fontSize: "0.875rem", // Match text-sm (14px)
                  fontWeight: "400",
                  letterSpacing: "normal",
                }}
              >
                {search || ""}
              </span>

              <input
                ref={inputRef}
                placeholder="Search issues..."
                className="flex-1 bg-transparent border-0 text-sm focus:outline-none placeholder:text-muted-foreground relative z-10"
                style={{ paddingRight: `${badgeAreaWidth}px` }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {/* Badges positioned absolutely on the right */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20">
                {visibleBadges.map((badge) => (
                  <Badge
                    key={badge.id}
                    variant="secondary"
                    className="h-7 px-2 font-normal whitespace-nowrap gap-1 pr-1 bg-muted/40 border-muted hover:bg-muted pointer-events-auto shrink-0"
                  >
                    {badge.label}
                    <button
                      type="button"
                      className="ml-1 h-4 w-4 rounded-sm hover:bg-muted-foreground/20 flex items-center justify-center transition-colors relative z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        badge.clear();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      aria-label={`Clear ${badge.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {hiddenBadgeCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-7 px-2 font-normal whitespace-nowrap bg-muted/40 border-muted hover:bg-muted pointer-events-auto shrink-0"
                  >
                    +{hiddenBadgeCount}
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2.5 rounded-full text-xs font-bold border border-muted-foreground/20 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors shrink-0"
              onClick={clearAll}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
        </div>

        {/* Row 2: Main Filter Selects */}
        <div className="p-3">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            <MultiSelect
              options={machineOptions}
              value={selectedMachines}
              onChange={setSelectedMachines}
              placeholder="Machine"
              className="h-9"
            />
            <MultiSelect
              groups={statusGroups}
              value={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="Status"
              className="h-9"
            />
            <MultiSelect
              options={severityOptions}
              value={selectedSeverities}
              onChange={setSelectedSeverities}
              placeholder="Severity"
              className="h-9"
            />
            <MultiSelect
              options={priorityOptions}
              value={selectedPriorities}
              onChange={setSelectedPriorities}
              placeholder="Priority"
              className="h-9"
            />
            <MultiSelect
              options={assigneeOptions}
              value={selectedAssignees}
              onChange={setSelectedAssignees}
              placeholder="Assignee"
              className="h-9"
            />
            <Button
              variant={expanded ? "secondary" : "outline"}
              className="h-9 gap-2"
              onClick={() => setExpanded(!expanded)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>{expanded ? "Less" : "More"}</span>
            </Button>
          </div>

          {/* Expanded Row: Owner, Reporter, Consistency, Date */}
          {expanded && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Owner
                </label>
                <MultiSelect
                  options={[]}
                  value={selectedOwners}
                  onChange={setSelectedOwners}
                  placeholder="Select Owner"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Reporter
                </label>
                <MultiSelect
                  options={[]}
                  value={selectedReporters}
                  onChange={setSelectedReporters}
                  placeholder="Select Reporter"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Consistency
                </label>
                <MultiSelect
                  options={[]}
                  value={selectedConsistencies}
                  onChange={setSelectedConsistencies}
                  placeholder="Select Consistency"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Date Range
                </label>
                <DateRangePicker
                  from={dateRange.from}
                  to={dateRange.to}
                  onChange={(range) => setDateRange(range)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Issues Log
              <Badge
                variant="secondary"
                className="ml-1 rounded-full font-bold"
              >
                {filteredIssues.length}
              </Badge>
            </h2>
          </div>

          <div className="flex-1" />

          {/* Split Pagination (Far Right) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium mr-2">
              {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredIssues.length)} of{" "}
              {filteredIssues.length}
            </span>
            <div className="flex items-center gap-1 border rounded-md bg-muted/20 p-0.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-background hover:shadow-sm disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="h-4 w-[1px] bg-border/50 mx-0.5" />
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(Math.ceil(filteredIssues.length / pageSize), p + 1)
                  )
                }
                disabled={
                  currentPage === Math.ceil(filteredIssues.length / pageSize)
                }
                className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-background hover:shadow-sm disabled:opacity-30 transition-all"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold gap-2"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  View Options
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Sort By
                </div>
                <DropdownMenuItem
                  onClick={() => handleSort("assignee")}
                  className="text-xs"
                >
                  <User className="mr-2 h-3.5 w-3.5" />
                  Assignee
                  {sortState.column === "assignee" && (
                    <span className="ml-auto text-[10px] text-primary">
                      {sortState.direction?.toUpperCase()}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSort("updatedAt")}
                  className="text-xs"
                >
                  Modified
                  {sortState.column === "updatedAt" && (
                    <span className="ml-auto text-[10px] text-primary">
                      {sortState.direction?.toUpperCase()}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSort("createdAt")}
                  className="text-xs"
                >
                  <Activity className="mr-2 h-3.5 w-3.5" />
                  Created
                  {sortState.column === "createdAt" && (
                    <span className="ml-auto text-[10px] text-primary">
                      {sortState.direction?.toUpperCase()}
                    </span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <IssueList
          issues={filteredIssues.slice(
            (currentPage - 1) * pageSize,
            currentPage * pageSize
          )}
          sortState={sortState}
          onSort={handleSort}
        />
      </div>

      {/* Verification Instructions */}
      <div className="text-[11px] text-muted-foreground mt-8 border-l-2 pl-4 py-1 border-muted space-y-2">
        <p className="font-semibold text-foreground uppercase tracking-tight">
          Mockup Verification Notes:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Search Bar: Integrated full-width bar with embedded badges.</li>
          <li>
            View Options: Dropdown menu next to "Issue Log" for extended sorting
            (Assignee, Modified, Created).
          </li>
          <li>
            Responsive: Columns drop from the right (Created removed, Modified @
            MD, Assignee @ LG). Issue column min-width 200px.
          </li>
          <li>
            Status Column: Icon + Text layout (no badge, colored icon, white
            text).
          </li>
          <li>
            Status Filter: Group headings (New, In Progress, Resolved) now have
            checkboxes to toggle all issues in that category at once.
          </li>
        </ul>
      </div>
    </div>
  );
}
