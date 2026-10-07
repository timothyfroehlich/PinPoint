import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { getViewer } from "~/lib/auth/viewer";
import { formatIssueId } from "~/lib/issues/utils";
import type { IssueViewResult, IssueViewSavedState } from "~/lib/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
vi.mock("~/lib/auth/viewer", () => ({ getViewer: vi.fn() }));

const { loadIssueView } = await import("~/lib/issues/view/queries");
const { loadIssueViewSavedViews, listSavedIssueViews } =
  await import("~/lib/issues/view/saved-views");
const { createSavedView } = await import("~/lib/list-view/saved-views");
const { ISSUE_VIEW_PRESET } = await import("~/lib/issues/view/config");
const { toIssueViewSavedState } = await import("~/lib/issues/view/state");

const VIEWER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const GONE = "99999999-9999-4999-8999-999999999999";

function ids(result: IssueViewResult): string[] {
  return result.rows.map((row) =>
    formatIssueId(row.machineInitials, row.issueNumber)
  );
}

/** The open issues the widgets count (issue-widgets §2.2, §2.4). */
function counted(result: IssueViewResult): number {
  return result.summary.open;
}

function load(query: string, scope?: string[]): Promise<IssueViewResult> {
  return loadIssueView({ searchParams: new URLSearchParams(query), scope });
}

/**
 * Issue View's loader (issues-list §2, §4, §7) against PGlite: validation of
 * the URL against what exists, the `me` sentinel, the Machine filter's
 * options, and the tab scope.
 */
describe("loadIssueView", () => {
  setupTestDb();

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: VIEWER, firstName: "Vera", lastName: "Viewer" }),
        createTestUser({ id: OTHER, firstName: "Otto", lastName: "Other" }),
      ]);
    await db.insert(machines).values([
      createTestMachine({ initials: "AA", name: "Alpha", ownerId: VIEWER }),
      createTestMachine({ initials: "BB", name: "Bravo" }),
      createTestMachine({
        initials: "RR",
        name: "Retired",
        ownerId: VIEWER,
        presenceStatus: "removed",
      }),
    ]);
    await db
      .insert(issues)
      .values([
        createTestIssue("AA", { issueNumber: 1, assignedTo: VIEWER }),
        createTestIssue("AA", { issueNumber: 2, assignedTo: OTHER }),
        createTestIssue("BB", { issueNumber: 1 }),
        createTestIssue("RR", { issueNumber: 1, assignedTo: VIEWER }),
      ]);
    vi.mocked(getViewer).mockResolvedValue({
      userId: VIEWER,
      role: "member",
      profile: null,
    });
  });

  it("resolves `me` to whoever is viewing (issues-list §7.3)", async () => {
    const result = await load("assignee=me&sort=id&dir=asc");
    expect(result.state.assignee).toEqual(["me"]);
    expect(ids(result)).toEqual(["AA-01"]);
  });

  it("drops `me` and Watching for an anonymous visitor (issues-list §4.9)", async () => {
    vi.mocked(getViewer).mockResolvedValue({
      userId: undefined,
      role: null,
      profile: null,
    });
    const result = await load("assignee=me&watching=true&sort=id&dir=asc");
    expect(result.state.assignee).toEqual([]);
    expect(result.state.watching).toBe(false);
    expect(result.signedIn).toBe(false);
    expect(result.myMachines).toEqual([]);
    expect(ids(result)).toEqual(["AA-01", "AA-02", "BB-01"]);
  });

  it("drops machines and people that do not exist (list-views §9.3)", async () => {
    const result = await load(`machine=AA,ZZ&assignee=${OTHER},${GONE}`);
    expect(result.state.machine).toEqual(["AA"]);
    expect(result.state.assignee).toEqual([OTHER]);
    expect(ids(result)).toEqual(["AA-02"]);
  });

  it("ignores Unassigned for Reporter, which does not offer it (issues-list §4.10, list-views §9.3)", async () => {
    const result = await load("reporter=unassigned&sort=id&dir=asc");
    expect(result.state.reporter).toEqual([]);
    expect(ids(result)).toEqual(["AA-01", "AA-02", "BB-01"]);

    // Assignee keeps it (issues-list §4.6).
    const assignee = await load("assignee=unassigned&sort=id&dir=asc");
    expect(assignee.state.assignee).toEqual(["unassigned"]);
    expect(ids(assignee)).toEqual(["BB-01"]);
  });

  it("offers My machines only from a tab's own machines, not a selected one outside it (issues-list §4.5)", async () => {
    // The viewer owns AA, selected here from outside the tab's scope.
    const result = await load("machine=AA", ["BB"]);
    expect(result.machineOptions.map((m) => m.initials)).toEqual(["BB", "AA"]);
    expect(result.myMachines).toEqual([]);
  });

  it("leaves Removed machines out of Machine and My machines unless Presence includes Removed (issues-list §4.5)", async () => {
    const preset = await load("");
    expect(preset.machineOptions.map((m) => m.initials)).toEqual(["AA", "BB"]);
    expect(preset.myMachines).toEqual(["AA"]);

    const everyPresence = await load("presence=all");
    expect(everyPresence.machineOptions.map((m) => m.initials)).toEqual([
      "AA",
      "BB",
      "RR",
    ]);

    // A selected Removed machine stays listed.
    const selected = await load("machine=RR");
    expect(selected.machineOptions.map((m) => m.initials)).toContain("RR");
  });

  it("shows a machine's issues in every presence state from its link (issues-list §7.4)", async () => {
    expect(ids(await load("machine=RR"))).toEqual([]);
    expect(ids(await load("machine=RR&presence=all"))).toEqual(["RR-01"]);
  });

  it("offers a tab only its own machines and keeps a stale machine selected, matching nothing (list-views §10.18)", async () => {
    const result = await load("machine=BB", ["AA"]);
    expect(result.state.machine).toEqual(["BB"]);
    expect(result.rows).toEqual([]);
    expect(result.machineOptions.map((m) => m.initials)).toEqual(["AA", "BB"]);
    expect(result.machineOptions.find((m) => m.initials === "BB")).toEqual({
      initials: "BB",
      name: "Bravo",
    });
    // The widgets still count the tab's scope (issue-widgets §2.1).
    expect(counted(result)).toBe(2);
  });

  it("counts nothing for a group with no machines, yet loads (issue-widgets §2.1)", async () => {
    const result = await load("", []);
    expect(result.rows).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(counted(result)).toBe(0);
    expect(result.machineOptions).toEqual([]);
  });

  it("reads Created and Updated days on the collective's clock, America/Chicago (issues-list §4.8, PP-qv6x)", async () => {
    const db = await getTestDb();
    await db
      .insert(machines)
      .values(createTestMachine({ initials: "CC", name: "Charlie" }));
    const at = (iso: string): { createdAt: Date; updatedAt: Date } => ({
      createdAt: new Date(iso),
      updatedAt: new Date(iso),
    });
    await db.insert(issues).values([
      // 8 PM CDT on Oct 4, already Oct 5 in UTC.
      createTestIssue("CC", { issueNumber: 1, ...at("2026-10-05T01:00:00Z") }),
      // 11:30 PM CDT on Oct 5, already Oct 6 in UTC.
      createTestIssue("CC", { issueNumber: 2, ...at("2026-10-06T04:30:00Z") }),
      // Midnight CDT starting Oct 5: the exclusive end of Oct 4.
      createTestIssue("CC", { issueNumber: 3, ...at("2026-10-05T05:00:00Z") }),
    ]);
    const range = (query: string): Promise<IssueViewResult> =>
      load(`machine=CC&sort=id&dir=asc&${query}`);

    expect(ids(await range("created=2026-10-04..2026-10-04"))).toEqual([
      "CC-01",
    ]);
    expect(ids(await range("created=2026-10-05..2026-10-05"))).toEqual([
      "CC-02",
      "CC-03",
    ]);
    expect(ids(await range("updated=2026-10-05..2026-10-05"))).toEqual([
      "CC-02",
      "CC-03",
    ]);
  });

  it("clamps a page past the end to the last page (list-views §6.3)", async () => {
    const result = await load("page=40");
    expect(result.state.page).toBe(1);
    expect(result.rows).toHaveLength(3);
  });
});

/**
 * Issue Saved Views (list-views §10) on `/issues` and an Issues tab: the
 * Default View opens only on `/issues`, and stored values that no longer
 * exist are dropped as they are read.
 */
describe("issue Saved Views", () => {
  setupTestDb();

  const saved: IssueViewSavedState = {
    ...toIssueViewSavedState(ISSUE_VIEW_PRESET),
    severity: ["major"],
    assignee: ["me", GONE],
    machine: ["AA", "ZZ"],
  };

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: VIEWER, firstName: "Vera" }));
    await db
      .insert(machines)
      .values(createTestMachine({ initials: "AA", name: "Alpha" }));
    vi.mocked(getViewer).mockResolvedValue({
      userId: VIEWER,
      role: "member",
      profile: null,
    });
  });

  it("re-validates stored views as they are read (list-views §10.14)", async () => {
    const db = asDbOrTx(await getTestDb());
    const created = await createSavedView(db, {
      userId: VIEWER,
      host: "issues",
      name: "Mine",
      // Reporter offers no Unassigned (issues-list §4.10).
      state: { ...saved, reporter: ["unassigned"] },
      makeDefault: false,
    });
    if (!created.ok) throw new Error(created.message);

    const [view] = await listSavedIssueViews(db, VIEWER);
    expect(view?.state).toEqual({
      ...saved,
      assignee: ["me"],
      machine: ["AA"],
      reporter: [],
    });
  });

  it("opens the Default View only on /issues, at its canonical URL (list-views §10.10)", async () => {
    const db = asDbOrTx(await getTestDb());
    const created = await createSavedView(db, {
      userId: VIEWER,
      host: "issues",
      name: "Mine",
      state: saved,
      makeDefault: true,
    });
    if (!created.ok) throw new Error(created.message);
    const id = created.value.id;

    const issuesPage = await loadIssueViewSavedViews(
      "issues",
      new URLSearchParams()
    );
    expect(issuesPage.redirectTo).toBe(
      `/issues?severity=major&machine=AA&assignee=me&view=${id}`
    );
    expect(issuesPage.savedViews).toMatchObject({
      canSave: true,
      offersDefault: true,
      defaultViewId: id,
    });

    const tab = await loadIssueViewSavedViews("tab", new URLSearchParams());
    expect(tab.redirectTo).toBeNull();
    expect(tab.savedViews.offersDefault).toBe(false);
    expect(tab.savedViews.views.map((view) => view.id)).toEqual([id]);

    // A configured URL opens as written.
    const configured = await loadIssueViewSavedViews(
      "issues",
      new URLSearchParams("include_inactive_machines=true")
    );
    expect(configured.redirectTo).toBeNull();
  });

  it("offers anonymous visitors the Built-in Views without My issues (issues-list §6.3)", async () => {
    vi.mocked(getViewer).mockResolvedValue({
      userId: undefined,
      role: null,
      profile: null,
    });
    const page = await loadIssueViewSavedViews("issues", new URLSearchParams());
    expect(page.savedViews.canSave).toBe(false);
    expect(page.savedViews.builtInViews.map((view) => view.id)).toEqual([
      "open-issues",
      "unassigned",
      "recently-fixed",
    ]);
  });
});
