import "server-only";

import { getViewer } from "~/lib/auth/viewer";
import { getDefaultViewId, listSavedViews } from "~/lib/list-view/saved-views";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import type {
  MachineViewPresetId,
  MachineViewSavedState,
  MachineViewSavedViews,
  MachineViewSavedViewSummary,
} from "~/lib/types";
import { db, type DbTransaction } from "~/server/db";
import {
  getMachineViewBuiltInViews,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
} from "./config";
import { getExistingMachineViewOwners } from "./owners";
import {
  hasMachineViewConfiguration,
  normalizeMachineViewSavedState,
  parseMachineViewState,
  serializeMachineViewState,
  type MachineViewSearchParams,
} from "./state";

/**
 * The Machines page, the Machine View host's main page and the only machine
 * Surface that opens a Default View (list-views §10.10). Its Page Preset is
 * `machines`; every Collection and Tag tab uses `collection`.
 */
const MACHINES_PAGE = { preset: "machines", pathname: "/m" } as const;

/**
 * The Built-in Views that can be the host's Default View: the Machines
 * page's own (machine-views §9.1), since only that page opens a default.
 */
export function machineViewDefaultBuiltInIds(): string[] {
  return getMachineViewBuiltInViews(MACHINES_PAGE.preset).map(({ id }) => id);
}

/**
 * The account's machine Saved Views, ordered by name, each configuration
 * re-validated as it is read (list-views §10.14). An owner is dropped only
 * when that person no longer exists, never because a Surface's scope has
 * none of their machines (§10.18), so the configuration the menu compares
 * against is the one the loader applies on every Surface.
 */
export async function listSavedMachineViews(
  tx: DbTransaction,
  userId: string
): Promise<MachineViewSavedViewSummary[]> {
  const rows = await listSavedViews(tx, userId, "machines");
  const views = rows.map(({ id, name, state }) => ({
    id,
    name,
    state: normalizeMachineViewSavedState(state),
  }));
  // The owning account is signed in, so its Me filters stay (§4.2).
  const existingOwners = await getExistingMachineViewOwners(
    tx,
    views.flatMap((view) => view.state.owner),
    userId
  );
  return views.map((view) => ({
    ...view,
    state: {
      ...view.state,
      owner: view.state.owner.filter((id) => existingOwners.has(id)),
    },
  }));
}

export interface SavedMachineViewRequest {
  /** The validated `view` reference (list-views §9.6), or null. */
  activeViewId: string | null;
  /** Where to send a configuration-free URL that has a default (§10.10). */
  redirectTo: string | null;
}

/**
 * Decides how a Surface URL relates to the viewer's views. A URL with no view
 * configuration other than `page` opens `defaultViewId` at its canonical URL
 * (list-views §10.10, §10.11); callers pass a default only on the Machines
 * page. Any other URL opens as written. `view` is kept only when it names an
 * owned Saved View or one of this preset's Built-in Views (§9.6).
 */
export function resolveSavedMachineViewRequest({
  views,
  defaultViewId,
  preset,
  searchParams,
  pathname,
}: {
  views: MachineViewSavedViewSummary[];
  defaultViewId: string | null;
  preset: MachineViewPresetId;
  searchParams: MachineViewSearchParams;
  pathname: string;
}): SavedMachineViewRequest {
  const builtIns = getMachineViewBuiltInViews(preset);
  const find = (
    id: string | null
  ): { id: string; state: MachineViewSavedState } | null =>
    id === null
      ? null
      : (views.find((view) => view.id === id) ??
        builtIns.find((view) => view.id === id) ??
        null);

  if (!hasMachineViewConfiguration(searchParams)) {
    const defaultView = find(defaultViewId);
    if (!defaultView) return { activeViewId: null, redirectTo: null };
    // The bare URL already shows the Page Preset, which no `view` names.
    if (defaultView.id === MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset]) {
      return { activeViewId: null, redirectTo: null };
    }
    // The canonical URL the list itself writes, so the client never
    // rewrites it again: the default's configuration at the URL's page.
    const { page } = parseMachineViewState(searchParams, preset);
    const params = serializeMachineViewState(
      { ...defaultView.state, page },
      preset,
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

export interface MachineViewSavedViewsPageState {
  savedViews: MachineViewSavedViews;
  redirectTo: string | null;
}

/**
 * Loads the views a machine Surface offers the viewer and, on the Machines
 * page only, decides whether a configuration-free URL opens the account's
 * Default View (list-views §10.10). Every viewer gets the Surface's Built-in
 * Views (§10.1); accounts with the save capability also get every machine
 * Saved View, whichever Surface they were saved on (§10.5).
 */
export async function loadMachineViewSavedViews(
  preset: MachineViewPresetId,
  searchParams: MachineViewSearchParams
): Promise<MachineViewSavedViewsPageState> {
  const viewer = await getViewer();
  const builtInViews = getMachineViewBuiltInViews(preset).map(
    ({ id, name, state }) => ({ id, name, state })
  );
  const isMachinesPage = preset === MACHINES_PAGE.preset;
  const userId =
    viewer.userId !== undefined &&
    checkPermission("views.save", getAccessLevel(viewer.role))
      ? viewer.userId
      : null;
  let views: MachineViewSavedViewSummary[] = [];
  let defaultViewId: string | null = null;
  if (userId) {
    [views, defaultViewId] = await Promise.all([
      listSavedMachineViews(db, userId),
      getDefaultViewId(db, userId, "machines"),
    ]);
  }
  const request = resolveSavedMachineViewRequest({
    views,
    defaultViewId: isMachinesPage ? defaultViewId : null,
    preset,
    searchParams,
    pathname: MACHINES_PAGE.pathname,
  });
  return {
    savedViews: {
      canSave: userId !== null,
      offersDefault: userId !== null && isMachinesPage,
      builtInViews,
      views,
      defaultViewId,
      activeViewId: request.activeViewId,
    },
    redirectTo: request.redirectTo,
  };
}
