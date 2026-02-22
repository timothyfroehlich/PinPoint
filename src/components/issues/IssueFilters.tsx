"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X, Eye, EyeOff } from "lucide-react";
import { useSearchFilters } from "~/hooks/use-search-filters";
import { Button } from "~/components/ui/button";
import { MultiSelect } from "~/components/ui/multi-select";
import { DateRangePicker } from "~/components/ui/date-range-picker";
import { Badge } from "~/components/ui/badge";

import { cn } from "~/lib/utils";
import {
  STATUS_CONFIG,
  STATUS_GROUPS,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
  FREQUENCY_CONFIG,
  OPEN_STATUSES,
} from "~/lib/issues/status";
import { type IssueFilters as FilterState } from "~/lib/issues/filters";
import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueFrequency,
} from "~/lib/types";
import type { LucideIcon } from "lucide-react";
import type { UserStatus } from "~/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

/**
 * IssueFilters — Primary filter bar for the issues list page.
 *
 * ## Pattern
 * Renders a search input with inline badge chips, a grid of MultiSelect
 * dropdowns (machine, status, severity, priority, assignee), and a "More
 * Filters" toggle that expands date ranges, frequency, owner, reporter,
 * and watching filters.
 *
 * ## Composition
 * - Each filter is a `<MultiSelect>` configured with domain constant options
 * - Status filter uses grouped mode with `STATUS_GROUPS` sections (New, In Progress, Closed)
 * - Machine filter shows initials as badge labels via `badgeLabel` prop
 * - Filter state is managed via URL search params (see `useSearchFilters` hook)
 * - Owner options display machine count and invite status metadata inline
 *
 * ## Key Abstractions
 * - `STATUS_CONFIG` / `STATUS_GROUPS` (from `~/lib/issues/status`) drive status display
 * - `OPEN_STATUSES` is the default status selection (all non-closed)
 * - `getBadges()` builds smart badge chips: when all statuses in a group are
 *   selected, it shows the group name ("New", "In Progress") instead of
 *   individual status names. See `filter-utils.ts` for the extractable logic.
 * - Search input is debounced at 300ms before pushing to URL params
 *
 * ## Mobile Notes
 * Desktop uses this component directly. Mobile will use a separate chip-based
 * filter bar but should import shared utilities from `~/lib/issues/filter-utils`
 * for badge grouping and filter state management.
 */
interface MachineOption {
  initials: string;
  name: string;
}

/** Minimal user shape for filter dropdowns (CORE-SEC-006) */
export interface IssueFilterUser {
  id: string;
  name: string;
  machineCount: number;
  status: UserStatus;
}

interface IssueFiltersProps {
  machines: MachineOption[];
  users: IssueFilterUser[];
  filters: FilterState;
}

export function IssueFilters({
  machines,
  users,
  filters,
}: IssueFiltersProps): React.JSX.Element {
  const { pushFilters } = useSearchFilters(filters);
  const [isSearching, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState(filters.q ?? "");
  const [expanded, setExpanded] = React.useState(false);

  const searchBarRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

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
        value: value as IssueSeverity,
      })),
    []
  );

  const priorityOptions = React.useMemo(
    () =>
      Object.entries(PRIORITY_CONFIG).map(([value, config]) => ({
        label: config.label,
        value: value as IssuePriority,
      })),
    []
  );

  const frequencyOptions = React.useMemo(
    () =>
      Object.entries(FREQUENCY_CONFIG).map(([value, config]) => ({
        label: config.label,
        value: value as IssueFrequency,
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

  const ownerOptions = React.useMemo(
    () =>
      users.map((u) => {
        const suffix = [
          u.machineCount > 0 ? `(${String(u.machineCount)})` : "",
          u.status === "invited" ? "(Invited)" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return {
          label: suffix ? `${u.name} ${suffix}` : u.name,
          value: u.id,
        };
      }),
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

  const getBadges = React.useCallback((): {
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
          startTransition(() =>
            pushFilters({
              machine: filters.machine!.filter((v) => v !== m),
              page: 1,
            })
          ),
      });
    });

    const activeStatuses: readonly IssueStatus[] =
      filters.status ?? OPEN_STATUSES;

    if (activeStatuses.length > 0 && filters.status !== undefined) {
      const processedStatuses = new Set<string>();

      const checkGroup = (
        groupName: string,
        groupStatuses: readonly IssueStatus[],
        label: string
      ): void => {
        const currentGroupStatuses = groupStatuses;
        const hasAll = currentGroupStatuses.every((s) =>
          activeStatuses.includes(s)
        );
        if (hasAll) {
          badges.push({
            id: `status-group-${groupName}`,
            label: label,
            clear: () => {
              const nextStatuses = activeStatuses.filter(
                (s) => !(currentGroupStatuses as readonly string[]).includes(s)
              );
              pushFilters({ status: nextStatuses, page: 1 });
            },
          });
          currentGroupStatuses.forEach((s) => processedStatuses.add(s));
        }
      };

      checkGroup("new", STATUS_GROUPS.new, "New");
      checkGroup("in_progress", STATUS_GROUPS.in_progress, "In Progress");
      checkGroup("closed", STATUS_GROUPS.closed, "Closed");

      activeStatuses.forEach((s) => {
        if (!processedStatuses.has(s)) {
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
        }
      });
    } else if (filters.status === undefined) {
      badges.push({
        id: "status-group-new-default",
        label: "New",
        clear: () =>
          pushFilters({ status: [...STATUS_GROUPS.in_progress], page: 1 }),
      });
      badges.push({
        id: "status-group-ip-default",
        label: "In Progress",
        clear: () => pushFilters({ status: [...STATUS_GROUPS.new], page: 1 }),
      });
    }

    // Severity
    filters.severity?.forEach((s) => {
      const config = SEVERITY_CONFIG[s];
      badges.push({
        id: `severity-${s}`,
        label: config.label,
        icon: config.icon,
        iconColor: config.iconColor,
        clear: () => {
          const current = filters.severity ?? [];
          pushFilters({
            severity: current.filter((v) => v !== s),
            page: 1,
          });
        },
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
        clear: () => {
          const current = filters.priority ?? [];
          pushFilters({
            priority: current.filter((v) => v !== p),
            page: 1,
          });
        },
      });
    });

    // Frequency
    filters.frequency?.forEach((c) => {
      const config = FREQUENCY_CONFIG[c];
      badges.push({
        id: `frequency-${c}`,
        label: config.label,
        icon: config.icon,
        iconColor: config.iconColor,
        clear: () => {
          const current = filters.frequency ?? [];
          pushFilters({
            frequency: current.filter((v) => v !== c),
            page: 1,
          });
        },
      });
    });

    filters.assignee?.forEach((id) => {
      const user = users.find((u) => u.id === id);
      const label = id === "UNASSIGNED" ? "Unassigned" : (user?.name ?? id);
      badges.push({
        id: `assignee-${id}`,
        label: `Assigned: ${label}`,
        clear: () => {
          const current = filters.assignee ?? [];
          pushFilters({
            assignee: current.filter((v) => v !== id),
            page: 1,
          });
        },
      });
    });

    filters.owner?.forEach((id) => {
      const user = users.find((u) => u.id === id);
      badges.push({
        id: `owner-${id}`,
        label: `Owner: ${user?.name ?? id}`,
        clear: () => {
          const current = filters.owner ?? [];
          pushFilters({
            owner: current.filter((v) => v !== id),
            page: 1,
          });
        },
      });
    });

    filters.reporter?.forEach((id) => {
      const user = users.find((u) => u.id === id);
      badges.push({
        id: `reporter-${id}`,
        label: `Reporter: ${user?.name ?? id}`,
        clear: () => {
          const current = filters.reporter ?? [];
          pushFilters({
            reporter: current.filter((v) => v !== id),
            page: 1,
          });
        },
      });
    });

    if (filters.createdFrom || filters.createdTo) {
      badges.push({
        id: "created-date",
        label: "Created",
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
        label: "Modified",
        clear: () =>
          pushFilters({
            updatedFrom: undefined,
            updatedTo: undefined,
            page: 1,
          }),
      });
    }

    return badges;
  }, [filters, machineOptions, users, pushFilters]);

  const badgeList = React.useMemo(() => getBadges(), [getBadges]);

  // Simplification: Show all badges.
  const visibleBadges = badgeList;

  return (
    <div className="bg-card border rounded-lg shadow-sm divide-y">
      <div className="p-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => {
              pushFilters({ q: search, page: 1 });
            });
          }}
        >
          <div
            ref={searchBarRef}
            className={cn(
              "flex items-center gap-2 px-3 h-11 bg-background border rounded-md transition-all shadow-sm ring-offset-background flex-1 relative focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              isSearching && "opacity-70 grayscale-[0.3]"
            )}
          >
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 relative h-full flex items-center">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <input
                      ref={inputRef}
                      placeholder="Search issues..."
                      data-testid="issue-search"
                      className="flex-1 bg-transparent border-0 text-sm focus:outline-none placeholder:text-muted-foreground relative z-10 w-full"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    className="max-w-[300px] p-3"
                  >
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Search across titles, descriptions, IDs (e.g., AFM-101),
                      machine names, assignees, reporters, and comments.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div
                data-testid="filter-bar"
                className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20 pointer-events-none"
              >
                {visibleBadges.map((badge) => (
                  <Badge
                    key={badge.id}
                    data-testid="filter-badge"
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 whitespace-nowrap rounded-sm text-[10px] font-medium leading-none h-6 bg-secondary/50 border-secondary-foreground/10 text-secondary-foreground group/badge max-w-[120px] pointer-events-auto",
                      badge.iconColor
                    )}
                  >
                    {badge.icon && (
                      <badge.icon
                        className={cn("h-3 w-3 shrink-0", badge.iconColor)}
                      />
                    )}
                    <span className="truncate">{badge.label}</span>
                    <button
                      type="button"
                      className="opacity-0 group-hover/badge:opacity-100 p-0.5 hover:bg-secondary rounded-full transition-opacity ml-0.5"
                      onClick={() => badge.clear()}
                      aria-label={`Clear ${badge.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {(badgeList.length > 0 || search) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 px-3 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearch("");
                pushFilters(
                  {
                    q: undefined,
                    status: [],
                    machine: [],
                    severity: [],
                    priority: [],
                    assignee: [],
                    owner: [],
                    reporter: [],
                    frequency: [],
                    watching: undefined,
                    createdFrom: undefined,
                    createdTo: undefined,
                    updatedFrom: undefined,
                    updatedTo: undefined,
                  },
                  { resetPagination: true }
                );
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

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
            value={filters.status ?? [...OPEN_STATUSES]}
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
            className="h-9 justify-between font-normal text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Less Filters" : "More Filters"}
            <SlidersHorizontal className="ml-2 h-4 w-4" />
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
              options={frequencyOptions}
              value={filters.frequency ?? []}
              onChange={(val) =>
                pushFilters({
                  frequency: val as IssueFrequency[],
                  page: 1,
                })
              }
              placeholder="Frequency"
              data-testid="filter-frequency"
            />
            <MultiSelect
              options={ownerOptions}
              value={filters.owner ?? []}
              onChange={(val) => pushFilters({ owner: val, page: 1 })}
              placeholder="Owner"
              data-testid="filter-owner"
            />
            <MultiSelect
              options={userOptions}
              value={filters.reporter ?? []}
              onChange={(val) => pushFilters({ reporter: val, page: 1 })}
              placeholder="Reporter"
              data-testid="filter-reporter"
            />
            <Button
              variant={filters.watching ? "default" : "outline"}
              className="h-9 justify-between font-normal"
              onClick={() =>
                pushFilters({
                  watching: !filters.watching,
                  page: 1,
                })
              }
              data-testid="filter-watching"
            >
              <span className="truncate">
                {filters.watching ? "Watching: On" : "Watching"}
              </span>
              {filters.watching ? (
                <Eye className="ml-2 h-4 w-4 shrink-0" />
              ) : (
                <EyeOff className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
