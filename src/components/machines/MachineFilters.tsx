"use client";

import * as React from "react";
import { Search, X, ArrowUpDown } from "lucide-react";
import { useSearchFilters } from "~/hooks/use-search-filters";
import { Button } from "~/components/ui/button";
import { MultiSelect } from "~/components/ui/multi-select";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import type { UserStatus } from "~/lib/types/user";
import type {
  MachineFilters as FilterState,
  MachineStatus,
  MachineSort,
} from "~/lib/machines/filters";
import { getMachineStatusLabel } from "~/lib/machines/status";
import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

interface FilterUser {
  id: string;
  name: string;
  machineCount: number;
  status: UserStatus;
}

interface MachineFiltersProps {
  users: FilterUser[];
  filters: FilterState;
}

const SORT_LABELS: Record<MachineSort, string> = {
  name_asc: "Name (A-Z)",
  name_desc: "Name (Z-A)",
  status_desc: "Status (Worst First)",
  status_asc: "Status (Best First)",
  issues_desc: "Open Issues (Most)",
  issues_asc: "Open Issues (Least)",
  created_desc: "Date Added (Newest)",
  created_asc: "Date Added (Oldest)",
};

const STATUS_OPTIONS = [
  { label: "Operational", value: "operational" },
  { label: "Needs Service", value: "needs_service" },
  { label: "Unplayable", value: "unplayable" },
];

const PRESENCE_OPTIONS = [
  { label: "On the Floor", value: "on_the_floor" },
  { label: "Off the Floor", value: "off_the_floor" },
  { label: "On Loan", value: "on_loan" },
  { label: "Pending Arrival", value: "pending_arrival" },
  { label: "Removed", value: "removed" },
];

export function MachineFilters({
  users,
  filters,
}: MachineFiltersProps): React.JSX.Element {
  const { pushFilters } = useSearchFilters(filters);
  const [isSearching] = React.useTransition();
  const [search, setSearch] = React.useState(filters.q ?? "");

  const userOptions = React.useMemo(
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

  // Debounced search
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== (filters.q ?? "")) {
        pushFilters({ q: search || undefined });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.q, pushFilters]);

  // Sync search state when filters prop changes
  React.useEffect(() => {
    setSearch(filters.q ?? "");
  }, [filters.q]);

  const badges = React.useMemo(() => {
    const items: { id: string; label: string; clear: () => void }[] = [];

    // Status badges
    filters.status?.forEach((s) => {
      items.push({
        id: `status-${s}`,
        label: getMachineStatusLabel(s),
        clear: () =>
          pushFilters({
            status: filters.status?.filter((v) => v !== s),
          }),
      });
    });

    // Owner badges
    filters.owner?.forEach((id) => {
      const user = users.find((u) => u.id === id);
      items.push({
        id: `owner-${id}`,
        label: user?.name ?? id,
        clear: () =>
          pushFilters({
            owner: filters.owner?.filter((v) => v !== id),
          }),
      });
    });

    // Presence badges (only show non-default values)
    filters.presence?.forEach((presenceStatus) => {
      if (presenceStatus !== "on_the_floor") {
        items.push({
          id: `presence-${presenceStatus}`,
          label: getMachinePresenceLabel(presenceStatus),
          clear: () =>
            pushFilters({
              presence: filters.presence?.filter((v) => v !== presenceStatus),
            }),
        });
      }
    });

    return items;
  }, [filters, users, pushFilters]);

  const hasAnyFilter =
    search.length > 0 ||
    badges.length > 0 ||
    (filters.sort ?? "name_asc") !== "name_asc" ||
    (filters.presence &&
      filters.presence.length > 0 &&
      !(
        filters.presence.length === 1 && filters.presence[0] === "on_the_floor"
      ));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        {/* Search Bar */}
        <div className="relative flex-1 group">
          <div
            className={cn(
              "flex items-center gap-2 px-3 h-11 bg-surface-container border border-outline-variant rounded-full transition-all shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary",
              isSearching && "opacity-70"
            )}
          >
            <Search className="h-4 w-4 text-on-surface-variant shrink-0" />
            <div className="flex-1 min-w-0 relative flex items-center gap-1.5 overflow-hidden">
              <input
                placeholder="Search machines by name or initials..."
                className="flex-1 bg-transparent border-0 text-sm focus:outline-none placeholder:text-on-surface-variant h-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {/* Inline Badges */}
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {badges.map((badge) => (
                  <Badge
                    key={badge.id}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-0.5 whitespace-nowrap text-[10px] h-6 bg-secondary-container text-on-secondary-container border-0"
                  >
                    <span className="max-w-[100px] truncate">
                      {badge.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => badge.clear()}
                      className="hover:bg-on-secondary-container/10 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-11 px-4 rounded-full border-outline-variant"
              >
                <ArrowUpDown className="h-4 w-4" />
                {SORT_LABELS[filters.sort ?? "name_asc"]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.entries(SORT_LABELS) as [MachineSort, string][]).map(
                ([value, label]) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => pushFilters({ sort: value })}
                    className={cn(
                      filters.sort === value &&
                        "bg-secondary-container text-on-secondary-container"
                    )}
                  >
                    {label}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                pushFilters({
                  q: undefined,
                  status: [],
                  owner: [],
                  presence: undefined,
                  sort: "name_asc",
                });
              }}
              className="text-primary"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filter Selectors - Moved to second line */}
      <div className="flex flex-wrap gap-2">
        <div className="w-full sm:w-48">
          <MultiSelect
            options={STATUS_OPTIONS}
            value={filters.status ?? []}
            onChange={(val) => pushFilters({ status: val as MachineStatus[] })}
            placeholder="Status"
          />
        </div>
        <div className="w-full sm:w-48">
          <MultiSelect
            options={userOptions}
            value={filters.owner ?? []}
            onChange={(val) => pushFilters({ owner: val })}
            placeholder="Owner"
          />
        </div>
        <div className="w-full sm:w-48">
          <MultiSelect
            options={PRESENCE_OPTIONS}
            value={filters.presence ?? ["on_the_floor"]}
            onChange={(val) =>
              pushFilters({ presence: val as MachinePresenceStatus[] })
            }
            placeholder="Availability"
          />
        </div>
      </div>
    </div>
  );
}
