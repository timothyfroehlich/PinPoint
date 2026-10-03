"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";
import { getMachineViewPreset } from "~/lib/machines/view/config";
import {
  nextMachineViewSort,
  serializeMachineViewState,
} from "~/lib/machines/view/state";
import type {
  MachineViewPresetId,
  MachineViewResult,
  MachineViewSavedViews,
  MachineViewState,
} from "~/lib/types";
import { cn } from "~/lib/utils";
import { MachineSummaryWidgets } from "./MachineSummaryWidgets";
import { MachineViewCompactList } from "./MachineViewCompactList";
import { MachineViewPageControls } from "./MachineViewPageControls";
import { MachineViewTable } from "./MachineViewTable";
import {
  MachineViewSavedViewsMenu,
  type MachineViewSelectableView,
} from "./MachineViewSavedViewsMenu";
import { MachineViewToolbar } from "./MachineViewToolbar";
import type { MachineSelectionHandler } from "./field-catalog";

const MOBILE_MODE_STORAGE_KEY = "pinpoint:machine-view:mobile-mode";

interface MachineViewProps {
  result: MachineViewResult;
  preset: MachineViewPresetId;
  onMachineSelect?: MachineSelectionHandler | undefined;
  /** The views this Surface offers the viewer (list-views §10). */
  savedViews?: MachineViewSavedViews | null | undefined;
}

export function MachineView({
  result,
  preset,
  onMachineSelect,
  savedViews,
}: MachineViewProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState(result.state);
  const [searchValue, setSearchValue] = React.useState(result.state.q);
  const requestedQuery = React.useRef(result.state.q);
  const [mobileMode, setMobileMode] = React.useState<"compact" | "table">(
    "compact"
  );
  // The `view` URL reference (list-views §9.6) carried by every navigation until
  // another Saved View or the Page Preset is chosen.
  const serverViewReference = savedViews?.activeViewId ?? null;
  const viewReference = React.useRef(serverViewReference);
  const [activeViewId, setActiveViewId] = React.useState(serverViewReference);
  React.useEffect(() => {
    viewReference.current = serverViewReference;
    setActiveViewId(serverViewReference);
  }, [serverViewReference]);

  React.useEffect(() => {
    const isRequestedResult = result.state.q === requestedQuery.current;
    setState(result.state);
    if (!isRequestedResult) setSearchValue(result.state.q);
    requestedQuery.current = result.state.q;
  }, [result.state]);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(MOBILE_MODE_STORAGE_KEY);
    if (stored === "compact" || stored === "table") setMobileMode(stored);
  }, []);

  const navigate = React.useCallback(
    (
      next: MachineViewState,
      view: string | null = viewReference.current
    ): void => {
      requestedQuery.current = next.q;
      viewReference.current = view;
      setActiveViewId(view);
      setState(next);
      const query = serializeMachineViewState(next, preset, view).toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, preset, router]
  );

  React.useEffect(() => {
    if (searchValue.trim() === state.q) return;
    const timeout = window.setTimeout(() => {
      navigate({ ...state, q: searchValue.trim(), page: 1 });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [navigate, searchValue, state]);

  React.useEffect(() => {
    const canonical = serializeMachineViewState(
      result.state,
      preset,
      serverViewReference
    ).toString();
    if (canonical === searchParams.toString()) return;
    router.replace(canonical ? `${pathname}?${canonical}` : pathname, {
      scroll: false,
    });
  }, [
    pathname,
    preset,
    result.state,
    router,
    searchParams,
    serverViewReference,
  ]);

  function applyView(view: MachineViewSelectableView): void {
    setSearchValue(view.state.q);
    navigate({ ...view.state, page: 1 }, view.id);
  }

  function changeMobileMode(mode: "compact" | "table"): void {
    setMobileMode(mode);
    window.localStorage.setItem(MOBILE_MODE_STORAGE_KEY, mode);
  }

  function resetFilters(): void {
    const defaults = getMachineViewPreset(preset).defaultState;
    setSearchValue("");
    navigate({
      ...state,
      q: "",
      presence: defaults.presence,
      status: [],
      severity: [],
      owner: [],
      page: 1,
    });
  }

  // Paging from the bottom controls returns the reader to the top of the list;
  // navigation itself keeps scroll position (`scroll: false`).
  function navigateFromBottom(page: number): void {
    navigate({ ...state, page });
    rootRef.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div ref={rootRef} className="space-y-4" aria-busy={isPending}>
      <MachineSummaryWidgets
        summary={result.summary}
        state={state}
        onStateChange={navigate}
      />
      <MachineViewToolbar
        state={state}
        preset={preset}
        ownerOptions={result.ownerOptions}
        permittedFields={result.permittedFields}
        totalCount={result.totalCount}
        searchValue={searchValue}
        mobileMode={mobileMode}
        onSearchChange={setSearchValue}
        onStateChange={navigate}
        onMobileModeChange={changeMobileMode}
        renderSavedViewsMenu={
          savedViews
            ? (layout) => (
                <MachineViewSavedViewsMenu
                  layout={layout}
                  savedViews={savedViews}
                  activeViewId={activeViewId}
                  state={state}
                  preset={preset}
                  onApply={applyView}
                  onViewSaved={(viewId) => navigate(state, viewId)}
                />
              )
            : undefined
        }
      />
      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        {result.rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No machines match"
            description="Try removing a filter or using a broader search."
            action={
              <Button type="button" variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
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
                navigate({ ...state, ...nextSort, page: 1 });
              }}
              onMachineSelect={onMachineSelect}
            />
            {/* Phone: a floating bar held just above the tab bar while the
                list scrolls. Desktop: a plain row after the last machine. */}
            <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mt-3 flex justify-end rounded-xl border border-outline-variant bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur-sm md:static md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none md:backdrop-blur-none">
              <MachineViewPageControls
                state={state}
                permittedFields={result.permittedFields}
                totalCount={result.totalCount}
                mobileMode={mobileMode}
                onStateChange={navigate}
                onMobileModeChange={changeMobileMode}
                onNavigate={navigateFromBottom}
                testIdPrefix="machine-view-bottom"
                touchSized
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
