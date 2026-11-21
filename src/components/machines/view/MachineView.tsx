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
import { exportMachinesAction } from "~/app/(app)/m/export-action";
import {
  ListTitleRow,
  ListView,
  PageExportProvider,
  RegisterPageExport,
  type ListDisplayModel,
  type PageExport,
  type ListPaginationModel,
  type ListSortModel,
} from "~/components/list-view";
import { useListViewHost } from "~/components/list-view/use-list-view-host";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import type { MachineExportScope } from "~/app/(app)/m/export-schema";
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
import { MachineSummaryWidgets } from "./MachineSummaryWidgets";
import type {
  MachineRowAction,
  MachineSelectionHandler,
} from "./MachineListEntry";
import { MachineViewRows } from "./MachineViewRows";
import { buildMachineFilters } from "./machine-filters";

const NOUN = { one: "machine", other: "machines" } as const;

interface MachineViewProps {
  result: MachineViewResult;
  preset: MachineViewPresetId;
  /** The views this Surface offers the viewer (list-views §10). */
  savedViews: MachineViewSavedViews;
  /**
   * The page title row, when Machine View owns its page (the Machines page).
   * A Collection or Tag tab's title row belongs to its own page.
   */
  title?: string | undefined;
  /**
   * The page actions beside the title (list-views §3.2). They find the
   * list's Export through the PageExportProvider Machine View wraps its
   * page in when it draws the title row.
   */
  actions?: React.ReactNode;
  onMachineSelect?: MachineSelectionHandler | undefined;
  /**
   * An action at the end of each row, such as Add on Print settings sheets
   * (settings-sheets §2.2).
   */
  rowAction?: MachineRowAction | undefined;
  /** An action in the List Header that applies to the whole result. */
  listAction?: React.ReactNode;
  /**
   * The Surface to export from (machine-views §3.15). Export is a page
   * action in ⋯ (list-views §5.5), offered to signed-in viewers only; a
   * Surface without page actions leaves this out.
   */
  exportScope?: MachineExportScope | undefined;
  /** Whether the Summary Widgets show. A picker Surface leaves them out. */
  showSummary?: boolean;
  /** Told when a new result starts and finishes loading. */
  onBusyChange?: ((busy: boolean) => void) | undefined;
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
  rowAction,
  listAction,
  exportScope,
  showSummary = true,
  onBusyChange,
}: MachineViewProps): React.JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const defaults = getMachineViewPreset(preset).defaultState;
  const serialize = React.useCallback(
    (next: MachineViewState, view: string | null): URLSearchParams =>
      serializeMachineViewState(next, preset, view),
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
      applyBuiltIn: applyMachineBuiltInView,
      defaultPageName: "Machines",
      actions: MACHINE_VIEW_ACTIONS,
    });
  React.useEffect(() => onBusyChange?.(isPending), [isPending, onBusyChange]);

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

  // View options holds page size only.
  const display: ListDisplayModel = {
    pageSize: state.pageSize,
    pageSizes: LIST_PAGE_SIZES,
    onPageSizeChange: (pageSize) => {
      if (isListPageSize(pageSize)) update({ pageSize });
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

  // Export runs the list's own query on the server, within the Surface's
  // scope. The action requires sign-in, so anonymous visitors are not
  // offered it.
  const exportQuery = serializeMachineViewState(
    { ...state, page: 1 },
    preset
  ).toString();
  const { signedIn } = result;
  const pageExport = React.useMemo<PageExport | null>(() => {
    if (!signedIn || exportScope === undefined) return null;
    return {
      exportCsv: () =>
        exportMachinesAction({ query: exportQuery, scope: exportScope }),
      emptyMessage: "No machines to export.",
    };
  }, [signedIn, exportQuery, exportScope]);

  const summary = (
    <MachineSummaryWidgets
      summary={result.summary}
      state={state}
      onStateChange={(next) => update(next, false)}
    />
  );

  const page = (
    <div ref={rootRef} className="scroll-mt-14">
      <RegisterPageExport value={pageExport} />
      <ListView
        label="Machines list"
        noun={NOUN}
        titleRow={
          title ? <ListTitleRow title={title} actions={actions} /> : undefined
        }
        summary={showSummary ? summary : undefined}
        search={{
          id: "machine-view-search",
          label: "Search machines",
          value: state.q,
          onSearch: (q) => update({ q }),
        }}
        primaryFilters={filters}
        views={views}
        sort={sort}
        display={display}
        pagination={pagination}
        listAction={listAction}
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
        <MachineViewRows
          rows={result.rows}
          age={state.sort === "dateAdded" ? "added" : "lastServiced"}
          onMachineSelect={onMachineSelect}
          rowAction={rowAction}
        />
      </ListView>
    </div>
  );
  // Drawing its own title row, Machine View holds the page actions that
  // offer its Export; on a Collection or Tag tab the page header does.
  return title ? <PageExportProvider>{page}</PageExportProvider> : page;
}
