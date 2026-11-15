/**
 * The List Hosts built on List View (list-views §1). Saved Views and Default
 * Views belong to one host, not to a Surface (list-views §10.5, §10.9).
 */
export const LIST_HOSTS = ["machines", "issues"] as const;

export type ListHost = (typeof LIST_HOSTS)[number];

/** Longest Saved View name accepted (list-views §10.7). */
export const SAVED_VIEW_NAME_MAX = 60;

/**
 * A Saved View as storage returns it. `state` is the host's View
 * Configuration exactly as it was stored; each host re-validates it before
 * use, dropping values that no longer exist (list-views §10.14).
 */
export interface StoredSavedView {
  id: string;
  name: string;
  state: unknown;
}

/** What a Default View points at, or null to clear it (list-views §10.8). */
export type DefaultViewTarget =
  { kind: "saved"; id: string } | { kind: "builtIn"; id: string } | null;

export type SavedViewError = "NOT_FOUND" | "NAME_TAKEN" | "INVALID_NAME";

/** Page sizes every List View offers (list-views §5.7). */
export const LIST_PAGE_SIZES = [25, 50, 100] as const;

export type ListPageSize = (typeof LIST_PAGE_SIZES)[number];

/** A Saved View with its re-validated configuration (list-views §10.14). */
export interface ListSavedViewSummary<Saved> {
  id: string;
  name: string;
  state: Saved;
}

/** A Built-in View as the List Header shows it (list-views §10.16). */
export interface ListBuiltInView<Saved> {
  id: string;
  name: string;
  state: Saved;
}

/**
 * The views one Surface offers a viewer (list-views §10): the Surface's
 * Built-in Views and, for an account that can save, every Saved View of the
 * host. `activeViewId` is the validated `view` URL reference (§9.6) — an
 * owned Saved View id or a Built-in View id — or null, which means the Page
 * Preset's baseline. `defaultViewId` is the account's Default View for the
 * host, which only the host's main page opens (§10.10).
 */
export interface ListSavedViews<Saved> {
  /** Whether the viewer can save, change, and delete Saved Views (§10.1). */
  canSave: boolean;
  /**
   * Whether this Surface is the host's main page, where the Default View is
   * chosen and opens (§10.10); other Surfaces do not offer defaults.
   */
  offersDefault: boolean;
  builtInViews: ListBuiltInView<Saved>[];
  views: ListSavedViewSummary<Saved>[];
  defaultViewId: string | null;
  activeViewId: string | null;
}
