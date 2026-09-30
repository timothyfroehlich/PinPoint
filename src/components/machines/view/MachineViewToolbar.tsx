"use client";

import type React from "react";
import { Search, X } from "lucide-react";
import { MultiSelect, type Option } from "~/components/ui/multi-select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
  VALID_MACHINE_PRESENCE_STATUSES,
} from "~/lib/machines/presence";
import {
  getMachineStatusLabel,
  type MachineStatus,
} from "~/lib/machines/status";
import { getMachineViewPreset } from "~/lib/machines/view/config";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import {
  ISSUE_SEVERITY_VALUES,
  type IssueSeverity,
  type MachineViewFieldId,
  type MachineViewOwnerOption,
  type MachineViewPresetId,
  type MachineViewState,
} from "~/lib/types";
import { MachineViewPageControls } from "./MachineViewPageControls";

const STATUS_VALUES: MachineStatus[] = [
  "operational",
  "needs_service",
  "unplayable",
];

interface MachineViewToolbarProps {
  state: MachineViewState;
  preset: MachineViewPresetId;
  ownerOptions: MachineViewOwnerOption[];
  permittedFields: MachineViewFieldId[];
  totalCount: number;
  searchValue: string;
  mobileMode: "compact" | "table";
  onSearchChange: (value: string) => void;
  onStateChange: (next: MachineViewState) => void;
  onMobileModeChange: (mode: "compact" | "table") => void;
  /** Renders the Saved Views menu for a layout; absent when unavailable. */
  renderSavedViewsMenu?:
    ((layout: "desktop" | "mobile") => React.ReactNode) | undefined;
}

function listsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function MachineViewToolbar({
  state,
  preset,
  ownerOptions,
  permittedFields,
  totalCount,
  searchValue,
  mobileMode,
  onSearchChange,
  onStateChange,
  onMobileModeChange,
  renderSavedViewsMenu,
}: MachineViewToolbarProps): React.JSX.Element {
  const defaults = getMachineViewPreset(preset).defaultState;
  const presenceOptions: Option[] = VALID_MACHINE_PRESENCE_STATUSES.map(
    (value) => ({ value, label: getMachinePresenceLabel(value) })
  );
  const statusOptions: Option[] = STATUS_VALUES.map((value) => ({
    value,
    label: getMachineStatusLabel(value),
  }));
  const severityOptions: Option[] = ISSUE_SEVERITY_VALUES.map((value) => ({
    value,
    label: SEVERITY_CONFIG[value].label,
  }));
  const ownerSelectOptions: Option[] = ownerOptions.map((owner) => ({
    value: owner.id,
    label: owner.name,
  }));
  const labelByValue = new Map(
    [...presenceOptions, ...statusOptions, ...ownerSelectOptions].map(
      (option) => [option.value, option.label]
    )
  );
  // Severity and Playability share the value `unplayable`, so severity
  // labels resolve from their own map.
  const severityLabelByValue = new Map(
    severityOptions.map((option) => [option.value, option.label])
  );
  const presenceIsDefault =
    state.presence === "all" || defaults.presence === "all"
      ? state.presence === defaults.presence
      : listsEqual(state.presence, defaults.presence);
  const presenceChips = presenceIsDefault
    ? []
    : state.presence === "all"
      ? [{ value: "all", label: "All presence states" }]
      : state.presence.map((value) => ({
          value,
          label: labelByValue.get(value) ?? value,
        }));
  const chips = [
    ...presenceChips.map((chip) => ({ ...chip, key: "presence" as const })),
    ...state.status.map((value) => ({
      key: "status" as const,
      value,
      label: labelByValue.get(value) ?? value,
    })),
    ...state.severity.map((value) => ({
      key: "severity" as const,
      value,
      label: `${severityLabelByValue.get(value) ?? value} severity`,
    })),
    ...state.owner.map((value) => ({
      key: "owner" as const,
      value,
      label: labelByValue.get(value) ?? value,
    })),
  ];
  const hasFilters = searchValue.length > 0 || chips.length > 0;

  function update(partial: Partial<MachineViewState>, resetPage = true): void {
    onStateChange({
      ...state,
      ...partial,
      page: resetPage ? 1 : (partial.page ?? state.page),
    });
  }

  function removeChip(
    key: "presence" | "status" | "severity" | "owner",
    value: string
  ): void {
    if (key === "presence") {
      if (value === "all") {
        update({ presence: defaults.presence });
        return;
      }
      if (state.presence === "all") return;
      const next = state.presence.filter((item) => item !== value);
      update({ presence: next.length === 0 ? "all" : next });
      return;
    }
    if (key === "status") {
      update({ status: state.status.filter((item) => item !== value) });
      return;
    }
    if (key === "severity") {
      update({ severity: state.severity.filter((item) => item !== value) });
      return;
    }
    update({ owner: state.owner.filter((item) => item !== value) });
  }

  function clearFilters(): void {
    onSearchChange("");
    update({
      q: "",
      presence: defaults.presence,
      status: [],
      severity: [],
      owner: [],
    });
  }

  return (
    <div className="space-y-3">
      <div className="@container overflow-hidden rounded-lg border border-outline-variant bg-card shadow-sm">
        <div className="space-y-2 p-3">
          <div className="relative">
            <label htmlFor="machine-view-search" className="sr-only">
              Search machines
            </label>
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="machine-view-search"
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search machines…"
              className="h-11 bg-background pl-9"
            />
          </div>
          {hasFilters ? (
            <div
              role="region"
              aria-label="Active filters"
              className="flex flex-wrap items-center gap-2"
            >
              {searchValue ? (
                <Badge variant="secondary" className="gap-1 pl-2.5">
                  Search: {searchValue}
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    aria-label="Remove search filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ) : null}
              {chips.map((chip) => (
                <Badge
                  key={`${chip.key}-${chip.value}`}
                  variant="secondary"
                  className="gap-1 pl-2.5"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => removeChip(chip.key, chip.value)}
                    aria-label={`Remove ${chip.label} filter`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 border-t border-outline-variant p-3 @sm:grid-cols-2 @3xl:grid-cols-4">
          <MultiSelect
            options={presenceOptions}
            value={state.presence === "all" ? [] : state.presence}
            onChange={(value) =>
              update({
                presence:
                  value.length === 0
                    ? "all"
                    : value.filter((item): item is MachinePresenceStatus =>
                        VALID_MACHINE_PRESENCE_STATUSES.some(
                          (presence) => presence === item
                        )
                      ),
              })
            }
            placeholder="Presence"
          />
          <MultiSelect
            options={statusOptions}
            value={state.status}
            onChange={(value) =>
              update({
                status: value.filter((item): item is MachineStatus =>
                  STATUS_VALUES.some((status) => status === item)
                ),
              })
            }
            placeholder="Playability"
          />
          <MultiSelect
            options={severityOptions}
            value={state.severity}
            onChange={(value) =>
              update({
                severity: value.filter((item): item is IssueSeverity =>
                  ISSUE_SEVERITY_VALUES.some((severity) => severity === item)
                ),
              })
            }
            placeholder="Severity"
          />
          <MultiSelect
            options={ownerSelectOptions}
            value={state.owner}
            onChange={(owner) => update({ owner })}
            placeholder="Owner"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-tight text-foreground/90">
            Machines
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
            {totalCount}
          </span>
          {renderSavedViewsMenu ? (
            <div className="ml-1 hidden md:block">
              {renderSavedViewsMenu("desktop")}
            </div>
          ) : null}
        </div>
        <MachineViewPageControls
          state={state}
          permittedFields={permittedFields}
          totalCount={totalCount}
          mobileMode={mobileMode}
          onStateChange={onStateChange}
          onMobileModeChange={onMobileModeChange}
          onNavigate={(page) => update({ page }, false)}
        />
      </div>
      {renderSavedViewsMenu ? (
        <div className="px-1 md:hidden">{renderSavedViewsMenu("mobile")}</div>
      ) : null}
    </div>
  );
}
