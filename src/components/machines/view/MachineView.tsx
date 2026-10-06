"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import {
  createSavedMachineViewAction,
  deleteSavedMachineViewAction,
  renameSavedMachineViewAction,
  setMachineViewDefaultAction,
  updateSavedMachineViewAction,
} from "~/app/(app)/m/saved-view-actions";
import {
  ListSearchField,
  ListTitleRow,
  ListView,
  type ListDisplayModel,
  type ListPaginationModel,
  type ListSortModel,
} from "~/components/list-view";
import { useListViewHost } from "~/components/list-view/use-list-view-host";
import {
  SummaryRowToggle,
  useSummaryWidgetsController,
} from "~/components/summary-widgets";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { isListPageSize } from "~/lib/list-view/url-state";
import {
  getMachineViewPreset,
  MACHINE_VIEW_FIELDS,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
} from "~/lib/machines/view/config";
import {
  applyMachineBuiltInView,
  hasMachineViewConfiguration,
  isMachineViewField,
  nextMachineViewSort,
  serializeMachineViewState,
  toMachineViewSavedState,
} from "~/lib/machines/view/state";
import {
  LIST_PAGE_SIZES,
  type MachineViewFieldId,
  type MachineViewPresetId,
  type MachineViewResult,
  type MachineViewSavedState,
  type MachineViewSavedViews,
  type MachineViewState,
} from "~/lib/types";
import {
  MACHINE_SUMMARY_STORAGE_KEY,
  MachineSummaryRow,
  MachineSummaryWidgets,
} from "./MachineSummaryWidgets";
import { MachineViewCompactList } from "./MachineViewCompactList";
import { MachineViewTable } from "./MachineViewTable";
import type { MachineSelectionHandler } from "./field-catalog";
import { buildMachineFilters } from "./machine-filters";

const MOBILE_MODE_STORAGE_KEY = "pinpoint:machine-view:mobile-mode";
const NOUN = { one: "machine", other: "machines" } as const;

type MobileMode = "compact" | "table";

interface MachineViewProps {
  result: MachineViewResult;
  preset: MachineViewPresetId;
  /** The views this Surface offers the viewer (list-views §10). */
  savedViews: MachineViewSavedViews;
  /**
   * The page title row, when Machine View owns its page (the Machines page).
   * A Collection or Tag tab's title row belongs to its own page, so the
   * Summary Row toggle then sits on its own row (list-views §7.2).
   */
  title?: string | undefined;
  /** The page actions beside the title (list-views §3.2). */
  actions?: React.ReactNode;
  onMachineSelect?: MachineSelectionHandler | undefined;
}

/** How the sort control names a field, such as "Name" (machine-views §3.14). */
function sortFieldLabel(field: MachineViewFieldId): string {
  const definition = MACHINE_VIEW_FIELDS[field];
  return definition.sortLabel ?? definition.label;
}

const MACHINE_VIEW_ACTIONS = {
  create: createSavedMachineViewAction,
  update: updateSavedMachineViewAction,
  rename: renameSavedMachineViewAction,
  remove: deleteSavedMachineViewAction,
  setDefault: setMachineViewDefaultAction,
};

function withPage(
  saved: MachineViewSavedState,
  page: number
): MachineViewState {
  return { ...saved, page };
}

/**
 * Machine View on the shared List View (machine-views §2.4): it builds the
 * List View models from its own state and fields, and keeps the URL, the
 * Applied View, and the return-to-list memory in step with them.
 */
export function MachineView({
  result,
  preset,
  savedViews,
  title,
  actions,
  onMachineSelect,
}: MachineViewProps): React.JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [mobileMode, setMobileMode] = React.useState<MobileMode>("compact");
  const summaryController = useSummaryWidgetsController(
    MACHINE_SUMMARY_STORAGE_KEY
  );
  const defaults = getMachineViewPreset(preset).defaultState;
  const serialize = React.useCallback(
    (next: MachineViewState, view: string | null): URLSearchParams =>
      serializeMachineViewState(next, preset, view),
    [preset]
  );
  const applyBuiltIn = React.useCallback(
    (
      view: { id: string; state: MachineViewSavedState },
      current: MachineViewSavedState
    ): MachineViewSavedState => applyMachineBuiltInView(preset, view, current),
    [preset]
  );
  const { state, applied, edited, pagePresetName, isPending, update, views } =
    useListViewHost({
      resultState: result.state,
      savedViews,
      pagePresetViewId: MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset],
      pagePresetState: toMachineViewSavedState(defaults),
      serialize,
      hasConfiguration: hasMachineViewConfiguration,
      toSaved: toMachineViewSavedState,
      withPage,
      applyBuiltIn,
      defaultPageName: "Machines",
      actions: MACHINE_VIEW_ACTIONS,
    });

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MOBILE_MODE_STORAGE_KEY);
      if (stored === "compact" || stored === "table") setMobileMode(stored);
    } catch {
      // Storage can be unavailable; Compact list is the default.
    }
  }, []);

  function changeMobileMode(mode: MobileMode): void {
    setMobileMode(mode);
    try {
      window.localStorage.setItem(MOBILE_MODE_STORAGE_KEY, mode);
    } catch {
      // Without storage the choice lasts for this page view.
    }
  }

  const filters = buildMachineFilters({
    state,
    defaults,
    ownerOptions: result.ownerOptions,
    offersMe: result.offersMe,
    onChange: (partial) => update(partial),
  });

  function resetFilters(): void {
    // Like each filter's Reset (list-views §4.9), nothing happens at the
    // Page Preset: no page change and no navigation.
    if (filters.every((filter) => filter.atPreset)) return;
    update({
      presence: defaults.presence,
      status: defaults.status,
      severity: defaults.severity,
      owner: defaults.owner,
    });
  }

  const sort: ListSortModel = {
    fields: result.permittedFields.map((field) => ({
      value: field,
      label: sortFieldLabel(field),
    })),
    field: state.sort,
    dir: state.dir,
    label: `${sortFieldLabel(state.sort)}, ${MACHINE_VIEW_FIELDS[state.sort].directionLabels[state.dir]}`,
    directionLabels: (field) =>
      isMachineViewField(field)
        ? MACHINE_VIEW_FIELDS[field].directionLabels
        : { asc: "Ascending", desc: "Descending" },
    preferredDirection: (field) =>
      isMachineViewField(field)
        ? MACHINE_VIEW_FIELDS[field].preferredDirection
        : "asc",
    onChange: (field, dir) => {
      if (isMachineViewField(field)) update({ sort: field, dir });
    },
  };

  const display: ListDisplayModel = {
    pageSize: state.pageSize,
    pageSizes: LIST_PAGE_SIZES,
    onPageSizeChange: (pageSize) => {
      if (isListPageSize(pageSize)) update({ pageSize });
    },
    fields: {
      options: result.permittedFields
        .filter((field) => field !== "machine")
        .map((field) => ({
          value: field,
          label: MACHINE_VIEW_FIELDS[field].label,
        })),
      selected: state.columns.filter((field) => field !== "machine"),
      // Displayed fields keep the page (§4.8).
      onToggle: (value, checked) => {
        if (!isMachineViewField(value)) return;
        const columns = checked
          ? [...new Set([...state.columns, value])]
          : state.columns.filter((column) => column !== value);
        update({ columns }, false);
      },
    },
    layout: {
      label: "Layout",
      options: [
        { value: "compact", label: "Compact list" },
        { value: "table", label: "Table" },
      ],
      value: mobileMode,
      onChange: (value) => {
        if (value === "compact" || value === "table") changeMobileMode(value);
      },
    },
  };

  const pagination: ListPaginationModel = {
    page: state.page,
    pageSize: state.pageSize,
    totalCount: result.totalCount,
    onPage: (page, fromBottom) => {
      update({ page }, false);
      // The pagers below the list return the reader to the list's top.
      if (fromBottom) rootRef.current?.scrollIntoView({ block: "start" });
    },
  };

  const summary = (
    <MachineSummaryWidgets
      summary={result.summary}
      state={state}
      onStateChange={(next) => update(next, false)}
      controller={title ? summaryController : undefined}
    />
  );

  return (
    <div ref={rootRef} className="scroll-mt-14">
      <ListView
        label="Machines list"
        noun={NOUN}
        titleRow={
          title ? (
            <ListTitleRow
              title={title}
              actions={actions}
              summaryToggle={
                <SummaryRowToggle controller={summaryController}>
                  <MachineSummaryRow summary={result.summary} compact />
                </SummaryRowToggle>
              }
            />
          ) : undefined
        }
        summary={summary}
        search={
          <ListSearchField
            id="machine-view-search"
            value={state.q}
            onSearch={(q) => update({ q })}
            label="Search machines"
          />
        }
        primaryFilters={filters}
        views={views}
        sort={sort}
        display={display}
        pagination={pagination}
        busy={isPending}
        onResetAll={resetFilters}
        emptyState={({ discard, openPagePreset }) =>
          applied && !edited ? (
            <EmptyState
              icon={SearchX}
              title={`No machines in ${applied.name}`}
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No machines match"
              description="Try removing a filter or using a broader search."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={applied ? discard : openPagePreset}
                >
                  Back to {applied?.name ?? pagePresetName}
                </Button>
              }
            />
          )
        }
      >
        {mobileMode === "compact" ? (
          <MachineViewCompactList
            rows={result.rows}
            onMachineSelect={onMachineSelect}
          />
        ) : null}
        <MachineViewTable
          rows={result.rows}
          state={state}
          mobileMode={mobileMode}
          onSort={(field) => {
            const nextSort = nextMachineViewSort(state, field, preset);
            update(nextSort);
          }}
          onMachineSelect={onMachineSelect}
        />
      </ListView>
    </div>
  );
}
