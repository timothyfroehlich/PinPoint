"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { rememberListUrl } from "~/lib/list-view/return-to-list";
import type { ListSearchParams } from "~/lib/list-view/url-state";
import type {
  DefaultViewTarget,
  ListBuiltInView,
  ListSavedViews,
} from "~/lib/types";
import type { ActionOutcome, ActionOutcomeWith, ListViewsModel } from "./types";

/**
 * The Applied View (list-views §1): the account's Saved View the current
 * configuration came from, or the Built-in View whose search, filters, and
 * sorting it has.
 */
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
  /**
   * A Built-in View applied to `current` (list-views §1): the view's search,
   * filters, and sorting with `current`'s displayed fields and page size,
   * plus any field the host names for that view.
   */
  applyBuiltIn: (view: { id: string; state: Saved }, current: Saved) => Saved;
  /** The host's main page, where the Default View opens, such as "Machines". */
  defaultPageName: string;
  actions: ListViewHostActions<Saved>;
}

export interface ListViewHost<State, Saved> {
  state: State;
  /** Null once the configuration has left every view (list-views §1). */
  applied: AppliedView<Saved> | null;
  /** The Applied View is a Saved View the configuration differs from. */
  edited: boolean;
  /** The name of the Page Preset's Built-in View, such as "Open issues". */
  pagePresetName: string;
  /** A new result is loading (§3.5). */
  isPending: boolean;
  /**
   * Shows `next` in place (§9.7). `from` is the view it came from; the URL
   * names it only while it is still the Applied View (§9.6).
   */
  navigate: (next: State, from: string | null) => void;
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
 * §9.6), the Applied View and whether it is Edited (§1, §5.1, §5.2), URL
 * updates in place (§9.7), the canonical rewrite of older or invalid URLs
 * (§9.3, §9.4), the Default View's URL rules on the main page (§10.10,
 * §10.11), return-to-list memory (§11.1), and the Saved View controls (§10).
 * A host supplies how its state reads and writes and its own Server Actions.
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
    applyBuiltIn,
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

  const pagePresetView: ListBuiltInView<Saved> = savedViews.builtInViews.find(
    (view) => view.id === pagePresetViewId
  ) ?? { id: pagePresetViewId, name: "Standard view", state: pagePresetState };
  const builtInViews = savedViews.builtInViews.some(
    (view) => view.id === pagePresetViewId
  )
    ? savedViews.builtInViews
    : [pagePresetView, ...savedViews.builtInViews];
  const sameConfiguration = (left: Saved, right: Saved): boolean =>
    serialize(withPage(left, 1), null).toString() ===
    serialize(withPage(right, 1), null).toString();
  // A Built-in View sets search, filters, and sorting only, so displayed
  // fields and page size never decide whether it is applied (§1): both sides
  // take the current ones before they are compared.
  const hasBuiltIn = (view: ListBuiltInView<Saved>, current: Saved): boolean =>
    sameConfiguration(
      applyBuiltIn(view, current),
      applyBuiltIn({ id: view.id, state: current }, current)
    );
  /**
   * The Applied View of `current` (§1): the owned Saved View `reference`
   * names, else the Built-in View whose search, filters, and sorting it has
   * (`reference` first when it is one), else none.
   */
  const appliedFor = (
    current: Saved,
    reference: string | null
  ): AppliedView<Saved> | null => {
    const saved = savedViews.views.find((view) => view.id === reference);
    if (saved) return { ...saved, isSaved: true };
    const matching = builtInViews.filter((view) => hasBuiltIn(view, current));
    const builtIn =
      matching.find((view) => view.id === reference) ?? matching[0];
    return builtIn ? { ...builtIn, isSaved: false } : null;
  };
  /**
   * The `view` reference naming an Applied View (§9.6), or null for none.
   * The Page Preset's own view needs none: a URL without one shows it.
   */
  const referenceFor = (view: AppliedView<Saved> | null): string | null =>
    view === null || (!view.isSaved && view.id === pagePresetViewId)
      ? null
      : view.id;
  const referenceOf = (next: State, from: string | null): string | null =>
    referenceFor(appliedFor(toSaved(next), from));

  const applied = appliedFor(toSaved(state), viewId);
  // Only a Saved View can be Edited (§1, §5.2).
  const edited =
    applied?.isSaved === true &&
    !sameConfiguration(toSaved(state), applied.state);

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
  /** Shows `next` under the `view` reference `reference`. */
  const show = (next: State, reference: string | null): void => {
    const url = listUrl(next, reference, surface);
    setViewId(url.view);
    setState(next);
    startTransition(() => replaceQuery(url.query));
  };
  const navigate = (next: State, from: string | null): void =>
    show(next, referenceOf(next, from));

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
  // canonical URL (§9.3, §9.4), naming the view as navigation does: a `view`
  // whose view the configuration has left is dropped (§9.6).
  const serverReference = referenceOf(resultState, serverViewId);
  React.useEffect(() => {
    const { query } = listUrl(resultState, serverReference, surface);
    if (query === searchParams.toString()) return;
    replaceQuery(query);
  }, [
    listUrl,
    replaceQuery,
    resultState,
    searchParams,
    serverReference,
    surface,
  ]);

  // Returning to this list within the tab session reopens this URL (§11.1).
  React.useEffect(() => {
    const query = searchParams.toString();
    rememberListUrl(pathname, query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  /**
   * What applying a view shows, at page 1 (§10.6): a Saved View's whole
   * configuration, or a Built-in View's search, filters, and sorting with
   * the displayed fields and page size already showing (§1).
   */
  const opening = (id: string): State | null => {
    const saved = savedViews.views.find((view) => view.id === id);
    if (saved) return withPage(saved.state, 1);
    const builtIn = builtInViews.find((view) => view.id === id);
    return builtIn ? withPage(applyBuiltIn(builtIn, toSaved(state)), 1) : null;
  };

  const hrefFor = (id: string): string => {
    const next = opening(id);
    if (!next) return pathname;
    // Relative to the Page Preset (§9.5), named as navigation names it.
    const { query } = listUrl(next, referenceOf(next, id), surface);
    return query ? `${pathname}?${query}` : pathname;
  };

  const apply = (id: string): void => {
    const next = opening(id);
    if (next) navigate(next, id);
  };

  const views: ListViewsModel = {
    builtInViews: savedViews.builtInViews.map(({ id, name }) => ({ id, name })),
    savedViews: savedViews.views.map(({ id, name }) => ({ id, name })),
    appliedId: applied?.id ?? null,
    appliedName: applied?.name ?? null,
    appliedIsSaved: applied?.isSaved ?? false,
    edited,
    configurationKey: serialize({ ...state, page: 1 }, null).toString(),
    canSave: savedViews.canSave,
    offersDefault,
    defaultPageName,
    defaultViewId,
    hrefFor,
    onApply: apply,
    onDiscard: () => {
      if (applied) navigate(withPage(applied.state, 1), applied.id);
    },
    onOpenPagePreset: () => apply(pagePresetView.id),
    actions: {
      saveChanges: async () => {
        if (!applied?.isSaved) {
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
        // The new view is applied before the refreshed list names it.
        if (outcome.ok) show(state, outcome.value.id);
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
        const url = listUrl(state, referenceFor(applied), {
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

  return {
    state,
    applied,
    edited,
    pagePresetName: pagePresetView.name,
    isPending,
    navigate,
    update,
    views,
  };
}
