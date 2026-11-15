import "server-only";

import { inArray } from "drizzle-orm";
import { getViewer } from "~/lib/auth/viewer";
import { issueFiltersFromState, type IssueFilters } from "~/lib/issues/filters";
import { loadIssueListPage } from "~/lib/issues/list-page";
import { getExistingPeople } from "~/lib/list-view/people";
import {
  ME_PERSON_ID,
  UNASSIGNED_PERSON_ID,
  type ListSearchParams,
} from "~/lib/list-view/url-state";
import {
  getMachineChoices,
  getOwnedMachineInitials,
} from "~/lib/machines/queries";
import type {
  IssueViewResult,
  IssueViewSavedState,
  IssueViewState,
} from "~/lib/types";
import { db, type DbTransaction } from "~/server/db";
import { machines } from "~/server/db/schema";
import { parseIssueViewState } from "./state";

/**
 * The machines among `initials` that exist, whatever their presence, with
 * their names.
 */
export async function existingMachines(
  tx: DbTransaction,
  initials: readonly string[]
): Promise<Map<string, string>> {
  if (initials.length === 0) return new Map();
  const rows = await tx
    .select({ initials: machines.initials, name: machines.name })
    .from(machines)
    .where(inArray(machines.initials, [...new Set(initials)]));
  return new Map(rows.map((row) => [row.initials, row.name]));
}

/**
 * Drops values that name nothing (list-views §9.3, §10.14): machines and
 * people that do not exist, `me` and Watching for an anonymous visitor
 * (issues-list §4.9). A machine or person outside a tab's scope stays
 * selected and matches nothing there (list-views §10.18).
 */
export async function validateIssueViewState(
  tx: DbTransaction,
  state: IssueViewState,
  viewerId: string | null
): Promise<{
  state: IssueViewState;
  machines: Map<string, string>;
  people: Map<string, string>;
}> {
  const [machineNames, people] = await Promise.all([
    existingMachines(tx, state.machine),
    getExistingPeople(tx, peopleIn(state), viewerId),
  ]);
  return {
    state: keepExisting(state, machineNames, people, viewerId),
    machines: machineNames,
    people,
  };
}

/** Every person value a configuration holds. */
export function peopleIn(
  state: Pick<IssueViewState, "assignee" | "owner" | "reporter">
): string[] {
  return [...state.assignee, ...state.owner, ...state.reporter];
}

/**
 * `state` without the machines and people that do not exist. Reporter
 * offers no Unassigned (issues-list §4.10), so `unassigned` there is
 * dropped like any other value that names nothing (list-views §9.3).
 */
export function keepExisting<State extends IssueViewSavedState>(
  state: State,
  machineSet: ReadonlyMap<string, string>,
  people: ReadonlyMap<string, string>,
  viewerId: string | null
): State {
  const keepPeople = (values: readonly string[]): string[] =>
    values.filter((value) => people.has(value));
  return {
    ...state,
    machine: state.machine.filter((initials) => machineSet.has(initials)),
    assignee: keepPeople(state.assignee),
    owner: keepPeople(state.owner),
    reporter: keepPeople(state.reporter).filter(
      (value) => value !== UNASSIGNED_PERSON_ID
    ),
    watching: state.watching && viewerId !== null,
  };
}

/**
 * The query a URL runs for the current viewer, validated as the list
 * validates it, for Export (issues-list §5.4): the same issues, in the same
 * order, across every page.
 */
export async function issueFiltersForExport(
  searchParams: ListSearchParams,
  viewerId: string
): Promise<IssueFilters> {
  const { state } = await validateIssueViewState(
    db,
    parseIssueViewState(searchParams),
    viewerId
  );
  const {
    page: _page,
    pageSize: _pageSize,
    ...filters
  } = issueFiltersFromState(state, viewerId);
  return filters;
}

/**
 * Loads Issue View for one Surface (issues-list §2): the current page, the
 * filtered total, the Summary Widget counts, the validated state, and the
 * filter options. `scope` is a Collection or Tag tab's machines; absent on
 * `/issues`.
 */
export async function loadIssueView({
  searchParams,
  scope,
}: {
  searchParams: ListSearchParams;
  scope?: readonly string[] | undefined;
}): Promise<IssueViewResult> {
  const viewer = await getViewer();
  const viewerId = viewer.userId ?? null;
  const {
    state: validated,
    machines: selectedMachines,
    people: selectedPeople,
  } = await validateIssueViewState(
    db,
    parseIssueViewState(searchParams),
    viewerId
  );
  // Machine leaves out Removed machines unless Presence includes them; a
  // machine already selected stays listed (issues-list §4.5).
  const includeRemoved =
    validated.presence.length === 0 || validated.presence.includes("removed");
  const [page, machineChoices, owned] = await Promise.all([
    loadIssueListPage(issueFiltersFromState(validated, viewerId), {
      isAdmin: viewer.role === "admin", // permissions-audit-allow: SQL visibility flag for search, not a request gate
      scopeMachineInitials: scope,
    }),
    getMachineChoices(db, {
      includeRemoved,
      keepInitials: validated.machine,
      ...(scope === undefined ? {} : { within: scope }),
    }),
    viewerId === null
      ? Promise.resolve([])
      : getOwnedMachineInitials(db, viewerId),
  ]);
  const machineOptions = machineChoices.map(({ initials, name }) => ({
    initials,
    name,
  }));
  // My machines offers only the machines the control lists on its own, so
  // a selected machine outside a tab's scope never joins it.
  const offered = new Set(machineOptions.map((option) => option.initials));
  // A selected machine outside the options, such as one outside a tab's
  // scope, still shows by name on the control.
  for (const [initials, name] of selectedMachines) {
    if (!machineOptions.some((option) => option.initials === initials)) {
      machineOptions.push({ initials, name });
    }
  }
  // Every person who exists, plus any selected person the list lacks.
  const people = [...page.people];
  for (const [id, name] of selectedPeople) {
    if (id === ME_PERSON_ID || id === UNASSIGNED_PERSON_ID) continue;
    if (!people.some((person) => person.id === id)) {
      people.push({ id, name });
    }
  }

  return {
    rows: page.issuesList,
    totalCount: page.totalCount,
    summary: page.summary,
    state: { ...validated, page: page.page },
    machineOptions,
    people,
    myMachines: owned.filter((initials) => offered.has(initials)),
    signedIn: viewerId !== null,
  };
}
