import "server-only";

import { listSavedViews } from "~/lib/list-view/saved-views";
import {
  loadListSavedViews,
  type ListSavedViewsPageState,
} from "~/lib/list-view/saved-views-page";
import type { ListSearchParams } from "~/lib/list-view/url-state";
import type { ListUrlCodec } from "~/lib/list-view/view-request";
import { getViewer } from "~/lib/collections/viewer";
import type {
  IssueViewSavedState,
  IssueViewSavedViewSummary,
  IssueViewSurface,
} from "~/lib/types";
import type { DbTransaction } from "~/server/db";
import {
  getIssueViewBuiltInViews,
  ISSUE_VIEW_PAGE_PRESET_VIEW_ID,
} from "./config";
import { getExistingPeople } from "~/lib/list-view/people";
import { existingMachines, keepExisting, peopleIn } from "./queries";
import {
  hasIssueViewConfiguration,
  issueViewStateAt,
  normalizeIssueViewSavedState,
  parseIssueViewState,
  serializeIssueViewState,
} from "./state";

/** The Issues page, the host's main page (list-views §10.10). */
const ISSUES_PAGE_PATHNAME = "/issues";

/** How Issue View URLs read and write (issues-list §7). */
const issueUrlCodec: ListUrlCodec<IssueViewSavedState> = {
  hasConfiguration: hasIssueViewConfiguration,
  pageOf: (searchParams) => parseIssueViewState(searchParams).page,
  openParams: (state, page, viewId) =>
    serializeIssueViewState(issueViewStateAt(state, page), viewId),
};

/**
 * The account's issue Saved Views, ordered by name, each configuration
 * re-validated as it is read (list-views §10.14): machines and people that
 * no longer exist are dropped, wherever the view is applied (§10.18).
 */
export async function listSavedIssueViews(
  tx: DbTransaction,
  userId: string
): Promise<IssueViewSavedViewSummary[]> {
  const rows = await listSavedViews(tx, userId, "issues");
  const views = rows.map(({ id, name, state }) => ({
    id,
    name,
    state: normalizeIssueViewSavedState(state),
  }));
  // One lookup for every view. The owning account is signed in, so its Me
  // filters stay (issues-list §7.3).
  const [machineSet, people] = await Promise.all([
    existingMachines(
      tx,
      views.flatMap((view) => view.state.machine)
    ),
    getExistingPeople(
      tx,
      views.flatMap((view) => peopleIn(view.state)),
      userId
    ),
  ]);
  return views.map((view) => ({
    ...view,
    state: keepExisting(view.state, machineSet, people, userId),
  }));
}

/**
 * Loads the views an Issues Surface offers the viewer and, on `/issues`
 * only, decides whether a configuration-free URL opens the account's Default
 * View (list-views §10.10). My issues is offered only to signed-in people
 * (issues-list §6.3).
 */
export async function loadIssueViewSavedViews(
  surface: IssueViewSurface,
  searchParams: ListSearchParams
): Promise<ListSavedViewsPageState<IssueViewSavedState>> {
  const viewer = await getViewer();
  return loadListSavedViews({
    host: "issues",
    builtInViews: getIssueViewBuiltInViews(viewer.userId !== undefined),
    pagePresetViewId: ISSUE_VIEW_PAGE_PRESET_VIEW_ID,
    isMainPage: surface === "issues",
    mainPathname: ISSUES_PAGE_PATHNAME,
    searchParams,
    listSaved: listSavedIssueViews,
    codec: issueUrlCodec,
  });
}
