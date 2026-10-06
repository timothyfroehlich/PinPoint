import "server-only";

import { listSavedViews } from "~/lib/list-view/saved-views";
import {
  loadListSavedViews,
  type ListSavedViewsPageState,
} from "~/lib/list-view/saved-views-page";
import {
  resolveSavedViewRequest,
  type ListUrlCodec,
  type SavedViewRequest,
} from "~/lib/list-view/view-request";
import type {
  MachineViewPresetId,
  MachineViewSavedState,
  MachineViewSavedViewSummary,
} from "~/lib/types";
import type { DbTransaction } from "~/server/db";
import {
  getMachineViewBuiltInViews,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
} from "./config";
import { getExistingPeople } from "~/lib/list-view/people";
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

/** How Machine View URLs on one preset read and write (list-views §9). */
function machineUrlCodec(
  preset: MachineViewPresetId
): ListUrlCodec<MachineViewSavedState> {
  return {
    hasConfiguration: hasMachineViewConfiguration,
    pageOf: (searchParams) => parseMachineViewState(searchParams, preset).page,
    openParams: (state, page, viewId) =>
      serializeMachineViewState({ ...state, page }, preset, viewId),
  };
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
  const existingOwners = await getExistingPeople(
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

/**
 * Decides how a machine Surface URL relates to the viewer's views
 * (list-views §9.6, §10.10); callers pass a default only on the Machines
 * page.
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
}): SavedViewRequest {
  return resolveSavedViewRequest({
    views,
    builtInViews: getMachineViewBuiltInViews(preset),
    pagePresetViewId: MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset],
    defaultViewId,
    searchParams,
    pathname,
    codec: machineUrlCodec(preset),
  });
}

export type MachineViewSavedViewsPageState =
  ListSavedViewsPageState<MachineViewSavedState>;

/**
 * Loads the views a machine Surface offers the viewer and, on the Machines
 * page only, decides whether a configuration-free URL opens the account's
 * Default View (list-views §10.10).
 */
export async function loadMachineViewSavedViews(
  preset: MachineViewPresetId,
  searchParams: MachineViewSearchParams
): Promise<MachineViewSavedViewsPageState> {
  return loadListSavedViews({
    host: "machines",
    builtInViews: getMachineViewBuiltInViews(preset),
    pagePresetViewId: MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset],
    isMainPage: preset === MACHINES_PAGE.preset,
    mainPathname: MACHINES_PAGE.pathname,
    searchParams,
    listSaved: listSavedMachineViews,
    codec: machineUrlCodec(preset),
  });
}
