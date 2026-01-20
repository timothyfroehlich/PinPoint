"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { MultiSelect } from "~/components/ui/multi-select";
import { DateRangePicker } from "~/components/ui/date-range-picker";
import { Badge } from "~/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import {
  STATUS_CONFIG,
  STATUS_GROUPS,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
  CONSISTENCY_CONFIG,
  OPEN_STATUSES,
} from "~/lib/issues/status";
import { type IssueFilters as FilterState } from "~/lib/issues/filters";
import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueConsistency,
} from "~/lib/types";
import type { LucideIcon } from "lucide-react";

interface MachineOption {
  initials: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
}

interface IssueFiltersProps {
  machines: MachineOption[];
  users: UserOption[];
  filters: FilterState;
}

export function IssueFilters({
  machines,
  users,
  filters,
}: IssueFiltersProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = React.useState(filters.q ?? "");
  const [expanded, setExpanded] = React.useState(false);

  const searchBarRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);

  const [textWidth, setTextWidth] = React.useState(0);
  const [badgeAreaWidth, setBadgeAreaWidth] = React.useState(0);
  const [visibleBadgeCount, setVisibleBadgeCount] = React.useState(Infinity);

  const machineOptions = React.useMemo(
    () =>
      machines.map((m) => ({
        label: m.name,
        value: m.initials,
        badgeLabel: m.initials,
      })),
    [machines]
  );

  const severityOptions = React.useMemo(
    () =>
      Object.entries(SEVERITY_CONFIG).map(([value, config]) => ({
        label: config.label,
        value,
      })),
    []
  );

  const priorityOptions = React.useMemo(
    () =>
      Object.entries(PRIORITY_CONFIG).map(([value, config]) => ({
        label: config.label,
        value,
      })),
    []
  );

  const consistencyOptions = React.useMemo(
    () =>
      Object.entries(CONSISTENCY_CONFIG).map(([value, config]) => ({
        label: config.label,
        value,
      })),
    []
  );

  const userOptions = React.useMemo(
    () => [
      { label: "Unassigned", value: "UNASSIGNED" },
      ...users.map((u) => ({
        label: u.name,
        value: u.id,
      })),
    ],
    [users]
  );

  const statusGroups = React.useMemo(
    () => [
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
    ],
    []
  );

  // Update URL function - memoized to prevent unnecessary effect triggers
  const pushFilters = React.useCallback(
    (newFilters: Partial<FilterState>): void => {
      const params = new URLSearchParams();
      const merged = { ...filters, ...newFilters };

      if (merged.q) params.set("q", merged.q);
      if (merged.status && merged.status.length > 0)
        params.set("status", merged.status.join(","));
      if (merged.machine && merged.machine.length > 0)
        params.set("machine", merged.machine.join(","));
      if (merged.severity && merged.severity.length > 0)
        params.set("severity", merged.severity.join(","));
      if (merged.priority && merged.priority.length > 0)
        params.set("priority", merged.priority.join(","));
      if (merged.assignee && merged.assignee.length > 0)
        params.set("assignee", merged.assignee.join(","));
      if (merged.owner && merged.owner.length > 0)
        params.set("owner", merged.owner.join(","));
      if (merged.reporter) params.set("reporter", merged.reporter);
      if (merged.consistency && merged.consistency.length > 0)
        params.set("consistency", merged.consistency.join(","));
      if (merged.watching) params.set("watching", "true");

      if (merged.createdFrom)
        params.set("created_from", merged.createdFrom.toISOString());
      if (merged.createdTo)
        params.set("created_to", merged.createdTo.toISOString());

      if (merged.updatedFrom)
        params.set("updated_from", merged.updatedFrom.toISOString());
      if (merged.updatedTo)
        params.set("updated_to", merged.updatedTo.toISOString());

      if (merged.sort && merged.sort !== "updated_desc")
        params.set("sort", merged.sort);
      if (merged.page && merged.page > 1)
        params.set("page", merged.page.toString());
      if (merged.pageSize && merged.pageSize !== 15)
        params.set("page_size", merged.pageSize.toString());

      router.push(`${pathname}?${params.toString()}`);
    },
    [filters, router, pathname]
  );

  // Debounced search
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== (filters.q ?? "")) {
        pushFilters({ q: search, page: 1 });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.q, pushFilters]);

  // Sync search state when filters prop changes (e.g. back button)
  React.useEffect(() => {
    setSearch(filters.q ?? "");
  }, [filters.q, setSearch]);

  // Measure text width for collision detection
  React.useEffect(() => {
    if (measureRef.current) {
      setTextWidth(measureRef.current.getBoundingClientRect().width);
    }
  }, [search]);

  const getBadges = (): {
    id: string;
    label: string;
    icon?: LucideIcon;
    iconColor?: string;
    clear: () => void;
  }[] => {
    const badges: {
      id: string;
      label: string;
      icon?: LucideIcon;
      iconColor?: string;
      clear: () => void;
    }[] = [];

    // Machines
    filters.machine?.forEach((m) => {
      const label =
        machineOptions.find((opt) => opt.value === m)?.badgeLabel ?? m;
      badges.push({
        id: `machine-${m}`,
        label,
        clear: () =>
          pushFilters({
            machine: filters.machine!.filter((v) => v !== m),
            page: 1,
          }),
      });
    });

    // Status - Show badges for current status filters (or defaults if none)
    const activeStatuses =
      filters.status ?? ([...OPEN_STATUSES] as IssueStatus[]);
    activeStatuses.forEach((s) => {
      const config = STATUS_CONFIG[s];
      badges.push({
        id: `status-${s}`,
        label: config.label,
        icon: config.icon,
        iconColor: config.iconColor,
        clear: () =>
          pushFilters({
            status: activeStatuses.filter((v) => v !== s),
            page: 1,
          }),
      });
    });

    // Severity
    filters.severity?.forEach((s) => {
      const config = SEVERITY_CONFIG[s];
      badges.push({
        id: `severity-${s}`,
        label: config.label,
        icon: config.icon,
        iconColor: config.iconColor,
        clear: () =>
          pushFilters({
            severity: filters.severity!.filter((v) => v !== s),
            page: 1,
          }),
      });
    });

    // Priority
    filters.priority?.forEach((p) => {
      const config = PRIORITY_CONFIG[p];
      badges.push({
        id: `priority-${p}`,
        label: config.label,
        icon: config.icon,
        iconColor: config.iconColor,
        clear: () =>
          pushFilters({
            priority: filters.priority!.filter((v) => v !== p),
            page: 1,
          }),
      });
    });

    // Consistency
    filters.consistency?.forEach((c) => {
      const config = CONSISTENCY_CONFIG[c];
      badges.push({
        id: `consistency-${c}`,
        label: config.label,
        icon: config.icon,
        iconColor: config.iconColor,
        clear: () =>
          pushFilters({
            consistency: filters.consistency!.filter((v) => v !== c),
            page: 1,
          }),
      });
    });

    // Assignee
    filters.assignee?.forEach((id) => {
      const user = users.find((u) => u.id === id);
      badges.push({
        id: `assignee-${id}`,
        label: `Assigned: ${user?.name ?? id}`,
        clear: () =>
          pushFilters({
            assignee: filters.assignee!.filter((v) => v !== id),
            page: 1,
          }),
      });
    });

    // Owner
    filters.owner?.forEach((id) => {
      const user = users.find((u) => u.id === id);
      badges.push({
        id: `owner-${id}`,
        label: `Owner: ${user?.name ?? id}`,
        clear: () =>
          pushFilters({
            owner: filters.owner!.filter((v) => v !== id),
            page: 1,
          }),
      });
    });

    // Reporter
    if (filters.reporter) {
      const user = users.find((u) => u.id === filters.reporter);
      badges.push({
        id: `reporter-${filters.reporter}`,
        label: `Reporter: ${user?.name ?? filters.reporter}`,
        clear: () => pushFilters({ reporter: undefined, page: 1 }),
      });
    }

    if (filters.createdFrom || filters.createdTo) {
      badges.push({
        id: "created-date",
        label: "Created Date",
        clear: () =>
          pushFilters({
            createdFrom: undefined,
            createdTo: undefined,
            page: 1,
          }),
      });
    }

    if (filters.updatedFrom || filters.updatedTo) {
      badges.push({
        id: "updated-date",
        label: "Modified Date",
        clear: () =>
          pushFilters({
            updatedFrom: undefined,
            updatedTo: undefined,
            page: 1,
          }),
      });
    }

    return badges;
  };

  const badgeList = getBadges();

  // Badge collision & layout calculation
  React.useEffect(() => {
    if (!searchBarRef.current) return;

    const calculateLayout = (): void => {
      window.requestAnimationFrame(() => {
        if (!searchBarRef.current) return;
        const containerWidth = searchBarRef.current.offsetWidth;
        if (containerWidth === 0) return;

        if (badgeList.length === 0) {
          setVisibleBadgeCount(0);
          setBadgeAreaWidth(0);
          return;
        }

        const leftPadding = 12; // px-3 left
        const rightPadding = 12; // px-3 right
        const iconWidth = 16; // search icon
        const iconGap = 8; // gap after icon
        const plusBadgeWidth = 36; // Reserved for "+X"
        const textBuffer = 10; // Space after text before collision

        const textStartPosition = leftPadding + iconWidth + iconGap;
        const textEndPosition = textStartPosition + textWidth + textBuffer;
        const badgeAreaRightEdge = containerWidth - rightPadding;
        const maxBadgeSpace = badgeAreaRightEdge - textEndPosition;

        const badgeGap = 6;
        const badgeWidths = badgeList.map((b) => b.label.length * 8 + 34);

        let totalNeeded = badgeWidths.reduce((a, b) => a + b + badgeGap, 0);
        if (badgeWidths.length > 0) totalNeeded -= badgeGap;

        if (totalNeeded <= maxBadgeSpace) {
          setVisibleBadgeCount(badgeList.length);
          setBadgeAreaWidth(totalNeeded);
          return;
        }

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
        const visibleWidth = badgeWidths
          .slice(0, count)
          .reduce((a, b) => a + b + badgeGap, 0);
        setBadgeAreaWidth(visibleWidth + plusBadgeWidth + badgeGap);
      });
    };

    calculateLayout();
    const ro = new ResizeObserver(calculateLayout);
    ro.observe(searchBarRef.current);
    return () => ro.disconnect();
  }, [badgeList, textWidth, searchBarRef]);

  const visibleBadges = badgeList.slice(0, visibleBadgeCount);
  const hiddenBadgeCount = badgeList.length - visibleBadgeCount;

  return (
    <div className="bg-card border rounded-lg shadow-sm divide-y">
      {/* Search Row */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div
            ref={searchBarRef}
            className={cn(
              "flex items-center gap-2 px-3 h-11 bg-background border rounded-md transition-all shadow-sm ring-offset-background flex-1 relative focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            )}
          >
            <Search className="h-4 w-4 text-muted-foreground shrink-0 relative z-10" />

            <span
              ref={measureRef}
              className="absolute invisible whitespace-pre pointer-events-none text-sm"
              style={{ left: "36px" }}
            >
              {search || ""}
            </span>

            <input
              ref={inputRef}
              placeholder="Search issues..."
              data-testid="issue-search"
              className="flex-1 bg-transparent border-0 text-sm focus:outline-none placeholder:text-muted-foreground relative z-10"
              style={{ paddingRight: `${badgeAreaWidth}px` }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20">
              {visibleBadges.map((badge) => (
                <Badge
                  key={badge.id}
                  variant="secondary"
                  className="h-7 px-2 font-normal whitespace-nowrap gap-1.5 pr-1 bg-muted/40 border-muted hover:bg-muted shrink-0"
                >
                  {badge.icon && (
                    <badge.icon
                      className={cn("h-3.5 w-3.5", badge.iconColor)}
                    />
                  )}
                  {badge.label}
                  <button
                    type="button"
                    className="ml-0.5 h-4 w-4 rounded-sm hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                    onClick={() => badge.clear()}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {hiddenBadgeCount > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="h-7 px-2 font-normal whitespace-nowrap bg-muted/40 border-muted shrink-0 hover:bg-muted cursor-pointer pointer-events-auto"
                    >
                      +{hiddenBadgeCount}
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 pb-2">
                      Hidden Filters
                    </div>
                    <div className="flex flex-col gap-1">
                      {badgeList.slice(visibleBadgeCount).map((badge) => (
                        <div
                          key={badge.id}
                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {badge.icon && (
                              <badge.icon
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0",
                                  badge.iconColor
                                )}
                              />
                            )}
                            <span className="truncate">{badge.label}</span>
                          </div>
                          <button
                            type="button"
                            className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20 flex items-center justify-center shrink-0 transition-colors"
                            onClick={() => badge.clear()}
                            aria-label={`Clear ${badge.label}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {(badgeList.length > 0 || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 px-3 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearch("");
                router.push(pathname);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Main Filter Row */}
      <div className="p-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <MultiSelect
            options={machineOptions}
            value={filters.machine ?? []}
            onChange={(val) => pushFilters({ machine: val, page: 1 })}
            placeholder="Machine"
            data-testid="filter-machine"
          />
          <MultiSelect
            groups={statusGroups}
            value={filters.status ?? ([...OPEN_STATUSES] as IssueStatus[])}
            onChange={(val) =>
              pushFilters({ status: val as IssueStatus[], page: 1 })
            }
            placeholder="Status"
            data-testid="filter-status"
          />
          <MultiSelect
            options={severityOptions}
            value={filters.severity ?? []}
            onChange={(val) =>
              pushFilters({ severity: val as IssueSeverity[], page: 1 })
            }
            placeholder="Severity"
            data-testid="filter-severity"
          />
          <MultiSelect
            options={priorityOptions}
            value={filters.priority ?? []}
            onChange={(val) =>
              pushFilters({ priority: val as IssuePriority[], page: 1 })
            }
            placeholder="Priority"
            data-testid="filter-priority"
          />
          <MultiSelect
            options={userOptions}
            value={filters.assignee ?? []}
            onChange={(val) => pushFilters({ assignee: val, page: 1 })}
            placeholder="Assignee"
            data-testid="filter-assignee"
          />
          <Button
            variant="outline"
            className="h-9 justify-start font-normal text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {expanded ? "Less Filters" : "More Filters"}
          </Button>
        </div>

        {expanded && (
          <div className="mt-2 pt-2 border-t grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1">
            <DateRangePicker
              from={filters.createdFrom}
              to={filters.createdTo}
              placeholder="Created"
              data-testid="filter-created"
              onChange={(range) => {
                pushFilters({
                  createdFrom: range.from ?? undefined,
                  createdTo: range.to ?? undefined,
                  page: 1,
                });
              }}
            />
            <DateRangePicker
              from={filters.updatedFrom}
              to={filters.updatedTo}
              placeholder="Modified"
              data-testid="filter-modified"
              onChange={(range) => {
                pushFilters({
                  updatedFrom: range.from ?? undefined,
                  updatedTo: range.to ?? undefined,
                  page: 1,
                });
              }}
            />
            <MultiSelect
              options={consistencyOptions}
              value={filters.consistency ?? []}
              onChange={(val) =>
                pushFilters({
                  consistency: val as IssueConsistency[],
                  page: 1,
                })
              }
              placeholder="Consistency"
              data-testid="filter-consistency"
            />
            <MultiSelect
              options={userOptions}
              value={filters.owner ?? []}
              onChange={(val) => pushFilters({ owner: val, page: 1 })}
              placeholder="Owner"
              data-testid="filter-owner"
            />
            <MultiSelect
              options={userOptions}
              value={filters.reporter ? [filters.reporter] : []}
              onChange={(val) => pushFilters({ reporter: val[0], page: 1 })}
              placeholder="Reporter"
              data-testid="filter-reporter"
            />
            <Button
              variant={filters.watching ? "default" : "outline"}
              className="h-9 justify-start font-normal"
              onClick={() =>
                pushFilters({
                  watching: !filters.watching,
                  page: 1,
                })
              }
              data-testid="filter-watching"
            >
              {filters.watching ? "Watching: On" : "Watching"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
