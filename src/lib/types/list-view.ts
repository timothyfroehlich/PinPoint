/**
 * The List Hosts built on List View (list-views §1). Saved Views and Default
 * Views belong to one host, not to a Surface (list-views §10.5, §10.9).
 */
export const LIST_HOSTS = ["machines", "issues"] as const;

export type ListHost = (typeof LIST_HOSTS)[number];

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
