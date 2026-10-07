import type {
  IssueFrequency,
  IssuePriority,
  IssueSeverity,
  IssueStatus,
  IssueViewSortDirection,
  IssueViewSortField,
  IssueViewState,
} from "~/lib/types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import { ME_PERSON_ID } from "~/lib/list-view/url-state";
import { startOfNextSiteDay, startOfSiteDay } from "~/lib/time-zone";

/**
 * What an issue query selects and how it orders them: the server-side form
 * of an Issue View configuration, with `me` resolved to the viewer. Every
 * field is optional; an absent field leaves that filter off, except that an
 * absent `status` means the Open statuses and an absent `presence` means On
 * the Floor, the Page Preset (issues-list §6.1).
 */
export interface IssueFilters {
  q?: string | undefined;
  /** Empty means every status. */
  status?: IssueStatus[] | undefined;
  machine?: string[] | undefined;
  severity?: IssueSeverity[] | undefined;
  priority?: IssuePriority[] | undefined;
  /** Account ids, plus `unassigned` for issues with no assignee. */
  assignee?: string[] | undefined;
  /** Machine owner ids, plus `unassigned` for machines with no owner. */
  owner?: string[] | undefined;
  reporter?: string[] | undefined;
  frequency?: IssueFrequency[] | undefined;
  /** Only issues `watcherId` watches. */
  watcherId?: string | undefined;
  /** Empty means every presence state. */
  presence?: MachinePresenceStatus[] | undefined;
  /**
   * Created and Updated ranges as instants: `From` is inclusive, `Before`
   * exclusive. {@link issueFiltersFromState} turns a range's picked days
   * into these bounds once, on the collective's local clock.
   */
  createdFrom?: Date | undefined;
  createdBefore?: Date | undefined;
  updatedFrom?: Date | undefined;
  updatedBefore?: Date | undefined;
  sort?: IssueViewSortField | undefined;
  dir?: IssueViewSortDirection | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

/** When a range's first day begins on the site clock. */
function rangeStart(day: string | null): Date | undefined {
  return day === null ? undefined : startOfSiteDay(day);
}

/** When a range's last day ends on the site clock: the next day's start. */
function rangeEnd(day: string | null): Date | undefined {
  return day === null ? undefined : startOfNextSiteDay(day);
}

/**
 * The query an Issue View configuration runs for one viewer (issues-list
 * §7.3): `me` means the signed-in viewer. For an anonymous visitor `me` and
 * Watching are dropped (§4.9), as validation drops them from the state.
 */
export function issueFiltersFromState(
  state: IssueViewState,
  viewerId: string | null
): IssueFilters {
  const resolved = (values: readonly string[]): string[] | undefined => {
    const ids = values.flatMap((value) =>
      value === ME_PERSON_ID ? (viewerId === null ? [] : [viewerId]) : [value]
    );
    return ids.length > 0 ? ids : undefined;
  };
  return {
    q: state.q || undefined,
    status: state.status,
    machine: state.machine.length > 0 ? state.machine : undefined,
    severity: state.severity,
    priority: state.priority,
    assignee: resolved(state.assignee),
    owner: resolved(state.owner),
    reporter: resolved(state.reporter),
    frequency: state.frequency,
    watcherId: state.watching && viewerId !== null ? viewerId : undefined,
    presence: state.presence,
    createdFrom: rangeStart(state.created.from),
    createdBefore: rangeEnd(state.created.to),
    updatedFrom: rangeStart(state.updated.from),
    updatedBefore: rangeEnd(state.updated.to),
    sort: state.sort,
    dir: state.dir,
    page: state.page,
    pageSize: state.pageSize,
  };
}
