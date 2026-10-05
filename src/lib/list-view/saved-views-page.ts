import "server-only";

import { getViewer } from "~/lib/collections/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import type {
  ListBuiltInView,
  ListHost,
  ListSavedViews,
  ListSavedViewSummary,
} from "~/lib/types";
import { db, type DbTransaction } from "~/server/db";
import { getDefaultViewId } from "./saved-views";
import type { ListSearchParams } from "./url-state";
import { resolveSavedViewRequest, type ListUrlCodec } from "./view-request";

export interface ListSavedViewsPageState<Saved> {
  savedViews: ListSavedViews<Saved>;
  redirectTo: string | null;
}

/**
 * Loads the views a Surface offers the viewer and, on the host's main page
 * only, decides whether a configuration-free URL opens the account's Default
 * View (list-views §10.10). Every viewer gets the Surface's Built-in Views
 * (§10.1); accounts with the save capability also get every Saved View of
 * the host, whichever Surface they were saved on (§10.5).
 */
export async function loadListSavedViews<Saved>({
  host,
  builtInViews,
  pagePresetViewId,
  isMainPage,
  mainPathname,
  searchParams,
  listSaved,
  codec,
}: {
  host: ListHost;
  builtInViews: readonly ListBuiltInView<Saved>[];
  pagePresetViewId: string;
  /** The host's main page (Machines or Issues), where the default opens. */
  isMainPage: boolean;
  mainPathname: string;
  searchParams: ListSearchParams;
  /** The account's Saved Views of this host, re-validated (§10.14). */
  listSaved: (
    tx: DbTransaction,
    userId: string
  ) => Promise<ListSavedViewSummary<Saved>[]>;
  codec: ListUrlCodec<Saved>;
}): Promise<ListSavedViewsPageState<Saved>> {
  const viewer = await getViewer();
  const userId =
    viewer.userId !== undefined &&
    checkPermission("views.save", getAccessLevel(viewer.role))
      ? viewer.userId
      : null;
  let views: ListSavedViewSummary<Saved>[] = [];
  let defaultViewId: string | null = null;
  if (userId) {
    [views, defaultViewId] = await Promise.all([
      listSaved(db, userId),
      getDefaultViewId(db, userId, host),
    ]);
  }
  const request = resolveSavedViewRequest({
    views,
    builtInViews,
    pagePresetViewId,
    defaultViewId: isMainPage ? defaultViewId : null,
    searchParams,
    pathname: mainPathname,
    codec,
  });
  return {
    savedViews: {
      canSave: userId !== null,
      offersDefault: userId !== null && isMainPage,
      builtInViews: builtInViews.map(({ id, name, state }) => ({
        id,
        name,
        state,
      })),
      views,
      defaultViewId,
      activeViewId: request.activeViewId,
    },
    redirectTo: request.redirectTo,
  };
}
