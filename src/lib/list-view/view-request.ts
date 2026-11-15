/**
 * How a Surface URL relates to the viewer's views (spec list-views.md §9.6,
 * §10.10, §10.11), the same for every List Host. Hosts supply how their URLs
 * read and write; this decides the `view` reference and whether a
 * configuration-free URL opens the Default View.
 */

import type { ListSearchParams } from "./url-state";

/** A Saved or Built-in View: its id and stored configuration. */
export interface ListViewDefinition<Saved> {
  id: string;
  state: Saved;
}

/** How one host reads and writes its List View URLs. */
export interface ListUrlCodec<Saved> {
  /** Whether a URL carries view configuration other than `page` (§10.10). */
  hasConfiguration: (searchParams: ListSearchParams) => boolean;
  /** The page a URL asks for. */
  pageOf: (searchParams: ListSearchParams) => number;
  /**
   * The canonical URL parameters that open a view's configuration at `page`,
   * naming the view (§9.5, §9.6) — the URL the list itself writes.
   */
  openParams: (state: Saved, page: number, viewId: string) => URLSearchParams;
}

export interface SavedViewRequest {
  /** The validated `view` reference (list-views §9.6), or null. */
  activeViewId: string | null;
  /** Where to send a configuration-free URL that has a default (§10.10). */
  redirectTo: string | null;
}

/**
 * A URL with no view configuration other than `page` opens `defaultViewId`
 * at its canonical URL (list-views §10.10, §10.11); callers pass a default
 * only on the host's main page. Any other URL opens as written. `view` is
 * kept only when it names an owned Saved View or one of the Surface's
 * Built-in Views (§9.6).
 */
export function resolveSavedViewRequest<Saved>({
  views,
  builtInViews,
  pagePresetViewId,
  defaultViewId,
  searchParams,
  pathname,
  codec,
}: {
  views: readonly ListViewDefinition<Saved>[];
  builtInViews: readonly ListViewDefinition<Saved>[];
  /** The Built-in View that is the Page Preset itself. */
  pagePresetViewId: string;
  defaultViewId: string | null;
  searchParams: ListSearchParams;
  pathname: string;
  codec: ListUrlCodec<Saved>;
}): SavedViewRequest {
  const find = (id: string | null): ListViewDefinition<Saved> | null =>
    id === null
      ? null
      : (views.find((view) => view.id === id) ??
        builtInViews.find((view) => view.id === id) ??
        null);

  if (!codec.hasConfiguration(searchParams)) {
    const defaultView = find(defaultViewId);
    if (!defaultView) return { activeViewId: null, redirectTo: null };
    // The bare URL already shows the Page Preset, which no `view` names.
    if (defaultView.id === pagePresetViewId) {
      return { activeViewId: null, redirectTo: null };
    }
    // The canonical URL the list itself writes, so the client never
    // rewrites it again: the default's configuration at the URL's page.
    const params = codec.openParams(
      defaultView.state,
      codec.pageOf(searchParams),
      defaultView.id
    );
    return {
      activeViewId: defaultView.id,
      redirectTo: `${pathname}?${params.toString()}`,
    };
  }
  return {
    activeViewId: find(searchParams.get("view"))?.id ?? null,
    redirectTo: null,
  };
}
