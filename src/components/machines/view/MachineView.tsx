"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  type ListViewsModel,
} from "~/components/list-view";
import {
  SummaryRowToggle,
  useSummaryWidgetsController,
} from "~/components/summary-widgets";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { rememberListUrl } from "~/lib/list-view/return-to-list";
import {
  getMachineViewPreset,
  MACHINE_VIEW_FIELDS,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
} from "~/lib/machines/view/config";
import {
  machineSortDirectionLabels,
  machineSortFieldLabel,
  machineSortLabel,
} from "~/lib/machines/view/sort-labels";
import {
  hasMachineViewConfiguration,
  isMachineViewField,
  isMachineViewPageSize,
  MACHINE_VIEW_PAGE_SIZES,
  machineViewSavedStatesEqual,
  nextMachineViewSort,
  savedMachineViewSearchParams,
  serializeMachineViewState,
  toMachineViewSavedState,
} from "~/lib/machines/view/state";
import type {
  MachineViewPresetId,
  MachineViewResult,
  MachineViewSavedState,
  MachineViewSavedViews,
  MachineViewState,
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

interface AppliedView {
  id: string;
  name: string;
  state: MachineViewSavedState;
  isSaved: boolean;
}

/**
 * The `view` reference a list URL carries (list-views §9.6). A URL with no
 * view configuration opens the account's Default View on the Machines page
 * (§10.10), so while one exists a list at its Page Preset names the Page
 * Preset's view rather than send the person to their default.
 */
function urlViewReference(
  state: MachineViewState,
  view: string | null,
  surface: {
    preset: MachineViewPresetId;
    pagePresetId: string;
    savedViews: Pick<MachineViewSavedViews, "offersDefault" | "defaultViewId">;
  }
): string | null {
  if (
    view === null &&
    surface.savedViews.offersDefault &&
    surface.savedViews.defaultViewId !== null &&
    !hasMachineViewConfiguration(
      serializeMachineViewState(state, surface.preset)
    )
  ) {
    return surface.pagePresetId;
  }
  return view;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState(result.state);
  const [mobileMode, setMobileMode] = React.useState<MobileMode>("compact");
  // Changes when a view is applied or changes are discarded (ListSearchField).
  const [searchReset, setSearchReset] = React.useState(0);
  const summaryController = useSummaryWidgetsController(
    MACHINE_SUMMARY_STORAGE_KEY
  );
  // The `view` URL reference (list-views §9.6). It runs ahead of the server's
  // until the next result arrives.
  const serverViewId = savedViews.activeViewId;
  const [viewId, setViewId] = React.useState(serverViewId);
  React.useEffect(() => setViewId(serverViewId), [serverViewId]);
  React.useEffect(() => setState(result.state), [result.state]);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MOBILE_MODE_STORAGE_KEY);
      if (stored === "compact" || stored === "table") setMobileMode(stored);
    } catch {
      // Storage can be unavailable; Compact list is the default.
    }
  }, []);

  const defaults = getMachineViewPreset(preset).defaultState;
  const pagePresetId = MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset];
  const findView = (id: string | null): AppliedView | null => {
    if (id === null) return null;
    const saved = savedViews.views.find((view) => view.id === id);
    if (saved) return { ...saved, isSaved: true };
    const builtIn = savedViews.builtInViews.find((view) => view.id === id);
    return builtIn ? { ...builtIn, isSaved: false } : null;
  };
  // No `view` reference means the Page Preset's configuration (§9.6).
  const pagePresetView: AppliedView = findView(pagePresetId) ?? {
    id: pagePresetId,
    name: "Standard view",
    state: toMachineViewSavedState(defaults),
    isSaved: false,
  };
  const applied = findView(viewId) ?? pagePresetView;
  const edited = !machineViewSavedStatesEqual(
    toMachineViewSavedState(state),
    applied.state,
    preset
  );

  const { offersDefault, defaultViewId } = savedViews;
  const navigate = React.useCallback(
    (next: MachineViewState, view: string | null): void => {
      const explicitView = urlViewReference(next, view, {
        preset,
        pagePresetId,
        savedViews: { offersDefault, defaultViewId },
      });
      setViewId(explicitView);
      setState(next);
      const query = serializeMachineViewState(
        next,
        preset,
        explicitView
      ).toString();
      startTransition(() => {
        // In place: no history entry per change and no scroll (§9.7).
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [defaultViewId, offersDefault, pagePresetId, pathname, preset, router]
  );

  const update = (partial: Partial<MachineViewState>, resetPage = true): void =>
    navigate(
      {
        ...state,
        ...partial,
        page: resetPage ? 1 : (partial.page ?? state.page),
      },
      viewId
    );

  // Rewrites older or invalid parameters and out-of-range pages to the
  // canonical URL (§9.3, §9.4), naming the view as navigation does.
  React.useEffect(() => {
    const canonical = serializeMachineViewState(
      result.state,
      preset,
      urlViewReference(result.state, serverViewId, {
        preset,
        pagePresetId,
        savedViews: { offersDefault, defaultViewId },
      })
    ).toString();
    if (canonical === searchParams.toString()) return;
    router.replace(canonical ? `${pathname}?${canonical}` : pathname, {
      scroll: false,
    });
  }, [
    defaultViewId,
    offersDefault,
    pagePresetId,
    pathname,
    preset,
    result.state,
    router,
    searchParams,
    serverViewId,
  ]);

  // Returning to this list within the tab session reopens this URL (§11.1).
  React.useEffect(() => {
    const query = searchParams.toString();
    rememberListUrl(pathname, query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

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
      label: machineSortFieldLabel(field),
    })),
    field: state.sort,
    dir: state.dir,
    label: machineSortLabel(state.sort, state.dir),
    directionLabels: (field) =>
      isMachineViewField(field)
        ? machineSortDirectionLabels(field)
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
    pageSizes: MACHINE_VIEW_PAGE_SIZES,
    onPageSizeChange: (pageSize) => {
      if (isMachineViewPageSize(pageSize)) update({ pageSize });
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

  const hrefFor = (id: string): string => {
    const view = findView(id);
    if (!view) return pathname;
    return `${pathname}?${savedMachineViewSearchParams(view.state, preset, view.id).toString()}`;
  };

  const views: ListViewsModel = {
    builtInViews: savedViews.builtInViews.map(({ id, name }) => ({ id, name })),
    savedViews: savedViews.views.map(({ id, name }) => ({ id, name })),
    appliedId: applied.id,
    appliedName: applied.name,
    appliedIsSaved: applied.isSaved,
    edited,
    canSave: savedViews.canSave,
    offersDefault,
    defaultPageName: "Machines",
    defaultViewId,
    hrefFor,
    // Applying a view opens it at page 1 (§10.6). Both moves drop a search
    // still waiting to run (list-views §4.1).
    onApply: (id) => {
      const view = findView(id);
      if (!view) return;
      setSearchReset((key) => key + 1);
      navigate({ ...view.state, page: 1 }, view.id);
    },
    onDiscard: () => {
      setSearchReset((key) => key + 1);
      navigate({ ...applied.state, page: 1 }, applied.id);
    },
    actions: {
      saveChanges: async () => {
        if (!applied.isSaved) {
          return { ok: false, message: "Only your own views can be changed" };
        }
        const outcome = await updateSavedMachineViewAction({
          id: applied.id,
          state: toMachineViewSavedState(state),
        });
        if (outcome.ok) router.refresh();
        return outcome;
      },
      saveAsNew: async ({ name, makeDefault }) => {
        const outcome = await createSavedMachineViewAction({
          name,
          state: toMachineViewSavedState(state),
          makeDefault,
        });
        if (outcome.ok) navigate(state, outcome.value.id);
        return outcome;
      },
      rename: async (id, name) => {
        const outcome = await renameSavedMachineViewAction({ id, name });
        if (outcome.ok) router.refresh();
        return outcome;
      },
      remove: async (id) => {
        const outcome = await deleteSavedMachineViewAction(id);
        if (outcome.ok) router.refresh();
        return outcome;
      },
      setDefault: async (target) => {
        const outcome = await setMachineViewDefaultAction({ target });
        if (outcome.ok) router.refresh();
        return outcome;
      },
    },
  };

  const summary = (
    <MachineSummaryWidgets
      summary={result.summary}
      state={state}
      onStateChange={(next) => navigate(next, viewId)}
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
            resetKey={searchReset}
            label="Search machines"
            placeholder="Search names, initials, manufacturers"
          />
        }
        primaryFilters={filters}
        views={views}
        sort={sort}
        display={display}
        pagination={pagination}
        busy={isPending}
        onResetAll={resetFilters}
        emptyState={
          <EmptyState
            icon={SearchX}
            title="No machines match"
            description={
              edited
                ? "Try removing a filter or using a broader search."
                : `${applied.name} has no machines right now.`
            }
            action={
              edited ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={views.onDiscard}
                >
                  Back to {applied.name}
                </Button>
              ) : undefined
            }
          />
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
