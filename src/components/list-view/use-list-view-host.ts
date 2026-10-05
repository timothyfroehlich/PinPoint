"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { rememberListUrl } from "~/lib/list-view/return-to-list";
import type { ListSearchParams } from "~/lib/list-view/url-state";
import type { DefaultViewTarget, ListSavedViews } from "~/lib/types";
import type { ActionOutcome, ActionOutcomeWith, ListViewsModel } from "./types";

/** A Saved View or Built-in View the current configuration came from. */
export interface AppliedView<Saved> {
  id: string;
  name: string;
  state: Saved;
  isSaved: boolean;
}

/** A host's Saved View Server Actions (list-views §10). */
export interface ListViewHostActions<Saved> {
  create: (input: {
    name: string;
    state: Saved;
    makeDefault: boolean;
  }) => Promise<ActionOutcomeWith<{ id: string }>>;
  update: (input: { id: string; state: Saved }) => Promise<ActionOutcome>;
  rename: (input: { id: string; name: string }) => Promise<ActionOutcome>;
  remove: (id: string) => Promise<ActionOutcome>;
  setDefault: (input: { target: DefaultViewTarget }) => Promise<ActionOutcome>;
}

export interface ListViewHostConfig<State extends { page: number }, Saved> {
  /** The validated state the server rendered. */
  resultState: State;
  /** The views this Surface offers the viewer (list-views §10). */
  savedViews: ListSavedViews<Saved>;
  /** The Built-in View that is this Surface's Page Preset. */
  pagePresetViewId: string;
  /** The Page Preset's configuration, if no Built-in View carries it. */
  pagePresetState: Saved;
  /** Canonical URL parameters relative to this Surface's Page Preset (§9.5). */
  serialize: (state: State, view: string | null) => URLSearchParams;
  /** Whether a URL carries view configuration other than `page` (§10.10). */
  hasConfiguration: (searchParams: ListSearchParams) => boolean;
  /** The configuration a Saved View stores: everything but the page (§10.2). */
  toSaved: (state: State) => Saved;
  /** A stored configuration at `page`. */
  withPage: (saved: Saved, page: number) => State;
  /** The host's main page, where the Default View opens, such as "Machines". */
  defaultPageName: string;
  actions: ListViewHostActions<Saved>;
}

export interface ListViewHost<State, Saved> {
  state: State;
  applied: AppliedView<Saved>;
  edited: boolean;
  /** A new result is loading (§3.5). */
  isPending: boolean;
  /** Shows `next` under the `view` reference `view`, in place (§9.7). */
  navigate: (next: State, view: string | null) => void;
  /**
   * Changes part of the configuration under the current view. Search,
   * filters, sorting, and page size return to page 1 (§4.7); pass
   * `resetPage` false to keep the page (§4.8) or to change it.
   */
  update: (partial: Partial<State>, resetPage?: boolean) => void;
  views: ListViewsModel;
}

/** What decides a list URL's `view` reference on one Surface. */
interface UrlSurface {
  pagePresetViewId: string;
  offersDefault: boolean;
  defaultViewId: string | null;
}

/**
 * The List View plumbing every host shares: the `view` reference (list-views
 * §9.6), the Applied View and whether it is Edited (§5.1, §5.2), URL updates
 * in place (§9.7), the canonical rewrite of older or invalid URLs (§9.3,
 * §9.4), the Default View's URL rules on the main page (§10.10, §10.11),
 * return-to-list memory (§11.1), and the Saved View controls (§10). A host
 * supplies how its state reads and writes and its own Server Actions.
 */
export function useListViewHost<State extends { page: number }, Saved>(
  config: ListViewHostConfig<State, Saved>
): ListViewHost<State, Saved> {
  const {
    resultState,
    savedViews,
    pagePresetViewId,
    pagePresetState,
    serialize,
    hasConfiguration,
    toSaved,
    withPage,
    defaultPageName,
    actions,
  } = config;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [state, setState] = React.useState(resultState);
  // The `view` URL reference (§9.6). It runs ahead of the server's until the
  // next result arrives.
  const serverViewId = savedViews.activeViewId;
  const [viewId, setViewId] = React.useState(serverViewId);
  React.useEffect(() => setViewId(serverViewId), [serverViewId]);
  React.useEffect(() => setState(resultState), [resultState]);

  // The latest serializer, so callbacks and effects keyed on the Surface
  // never rerun merely because a host passed a new function.
  const serializeRef = React.useRef(serialize);
  const hasConfigurationRef = React.useRef(hasConfiguration);
  React.useLayoutEffect(() => {
    serializeRef.current = serialize;
    hasConfigurationRef.current = hasConfiguration;
  }, [hasConfiguration, serialize]);

  const findView = (id: string | null): AppliedView<Saved> | null => {
    if (id === null) return null;
    const saved = savedViews.views.find((view) => view.id === id);
    if (saved) return { ...saved, isSaved: true };
    const builtIn = savedViews.builtInViews.find((view) => view.id === id);
    return builtIn ? { ...builtIn, isSaved: false } : null;
  };
  // No `view` reference means the Page Preset's configuration (§9.6).
  const pagePresetView: AppliedView<Saved> = findView(pagePresetViewId) ?? {
    id: pagePresetViewId,
    name: "Standard view",
    state: pagePresetState,
    isSaved: false,
  };
  const applied = findView(viewId) ?? pagePresetView;
  const sameConfiguration = (left: Saved, right: Saved): boolean =>
    serialize(withPage(left, 1), null).toString() ===
    serialize(withPage(right, 1), null).toString();
  const edited = !sameConfiguration(toSaved(state), applied.state);

  const { offersDefault, defaultViewId } = savedViews;
  const surface = React.useMemo<UrlSurface>(
    () => ({ pagePresetViewId, offersDefault, defaultViewId }),
    [defaultViewId, offersDefault, pagePresetViewId]
  );

  /**
   * A list URL's query and the `view` reference it carries (§9.6). A URL
   * with no view configuration opens the account's Default View on the
   * main page (§10.10), so while one exists a list at its Page Preset names
   * the Page Preset's view rather than send the person to their default.
   * When the default is the Page Preset's own view, the bare URL already
   * opens it, as the server keeps it.
   */
  const listUrl = React.useCallback(
    (
      next: State,
      view: string | null,
      on: UrlSurface
    ): { view: string | null; query: string } => {
      const params = serializeRef.current(next, view);
      if (
        view === null &&
        on.offersDefault &&
        on.defaultViewId !== null &&
        on.defaultViewId !== on.pagePresetViewId &&
        !hasConfigurationRef.current(params)
      ) {
        // `view` is the last parameter the serializer writes.
        params.set("view", on.pagePresetViewId);
        return { view: on.pagePresetViewId, query: params.toString() };
      }
      return { view, query: params.toString() };
    },
    []
  );

  // In place: no history entry per change and no scroll (§9.7).
  const replaceQuery = React.useCallback(
    (query: string): void => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router]
  );
  const navigate = React.useCallback(
    (next: State, view: string | null): void => {
      const url = listUrl(next, view, surface);
      setViewId(url.view);
      setState(next);
      startTransition(() => replaceQuery(url.query));
    },
    [listUrl, replaceQuery, surface]
  );

  const update = (partial: Partial<State>, resetPage = true): void =>
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
    const { query } = listUrl(resultState, serverViewId, surface);
    if (query === searchParams.toString()) return;
    replaceQuery(query);
  }, [listUrl, replaceQuery, resultState, searchParams, serverViewId, surface]);

  // Returning to this list within the tab session reopens this URL (§11.1).
  React.useEffect(() => {
    const query = searchParams.toString();
    rememberListUrl(pathname, query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  const hrefFor = (id: string): string => {
    const view = findView(id);
    if (!view) return pathname;
    // A view opens at page 1 (§10.6), relative to the Page Preset (§9.5).
    return `${pathname}?${serialize(withPage(view.state, 1), view.id).toString()}`;
  };

  const views: ListViewsModel = {
    builtInViews: savedViews.builtInViews.map(({ id, name }) => ({ id, name })),
    savedViews: savedViews.views.map(({ id, name }) => ({ id, name })),
    appliedId: applied.id,
    appliedName: applied.name,
    appliedIsSaved: applied.isSaved,
    edited,
    configurationKey: serialize({ ...state, page: 1 }, null).toString(),
    canSave: savedViews.canSave,
    offersDefault,
    defaultPageName,
    defaultViewId,
    hrefFor,
    // Applying a view opens it at page 1 (§10.6).
    onApply: (id) => {
      const view = findView(id);
      if (view) navigate(withPage(view.state, 1), view.id);
    },
    onDiscard: () => navigate(withPage(applied.state, 1), applied.id),
    actions: {
      saveChanges: async () => {
        if (!applied.isSaved) {
          return { ok: false, message: "Not your view" };
        }
        const outcome = await actions.update({
          id: applied.id,
          state: toSaved(state),
        });
        if (outcome.ok) router.refresh();
        return outcome;
      },
      saveAsNew: async ({ name, makeDefault }) => {
        const outcome = await actions.create({
          name,
          state: toSaved(state),
          makeDefault,
        });
        if (outcome.ok) navigate(state, outcome.value.id);
        return outcome;
      },
      rename: async (id, name) => {
        const outcome = await actions.rename({ id, name });
        if (outcome.ok) router.refresh();
        return outcome;
      },
      remove: async (id) => {
        const outcome = await actions.remove(id);
        if (outcome.ok) router.refresh();
        return outcome;
      },
      setDefault: async (target) => {
        const outcome = await actions.setDefault({ target });
        if (!outcome.ok) return outcome;
        // The list stays as it is (§10.10): once the account has a default,
        // a bare URL opens it, so a list at its Page Preset names that view
        // before the refresh reaches the server.
        const url = listUrl(state, viewId, {
          ...surface,
          defaultViewId: target?.id ?? null,
        });
        if (url.query !== searchParams.toString()) {
          setViewId(url.view);
          startTransition(() => replaceQuery(url.query));
        }
        router.refresh();
        return outcome;
      },
    },
  };

  return { state, applied, edited, isPending, navigate, update, views };
}
