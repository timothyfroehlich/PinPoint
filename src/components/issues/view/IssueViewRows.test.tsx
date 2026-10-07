/**
 * RTL tests for the two-line issue rows (issues-list §3): what each row
 * shows, which fields each viewer may change from the row (mirroring the
 * `issues.update.reporting` / `issues.update.triage` matrix rows the server
 * actions enforce), and rows holding their place after an edit (§3.6).
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IssueViewRows, type IssueRowsViewer } from "./IssueViewRows";
import type { IssueListRow } from "~/lib/types";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockUpdatePriority = vi.fn();
vi.mock("~/app/(app)/issues/actions", () => ({
  updateIssueStatusAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssuePriorityAction: (state: unknown, formData: FormData) =>
    mockUpdatePriority(state, formData),
  assignIssueAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const REPORTER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function makeIssue(overrides: Partial<IssueListRow> = {}): IssueListRow {
  return {
    id: "issue-1",
    issueNumber: 12,
    title: "Left flipper weak after the second multiball",
    status: "in_progress",
    severity: "major",
    priority: "high",
    frequency: "intermittent",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    machineInitials: "AFM",
    reporterName: null,
    assignedTo: null,
    machine: { id: "machine-1", name: "Attack from Mars", ownerId: null },
    reportedByUser: { id: REPORTER_ID, name: "Rhea Porter" },
    invitedReporter: null,
    assignedToUser: null,
    commentCount: 0,
    ...overrides,
  };
}

function renderList(
  issues: IssueListRow[],
  viewer: IssueRowsViewer,
  listKey = ""
): ReturnType<typeof render> {
  return render(
    <IssueViewRows
      rows={issues}
      listKey={listKey}
      users={[{ id: OTHER_ID, name: "Priya Shah" }]}
      viewer={viewer}
    />
  );
}

const ANONYMOUS: IssueRowsViewer = {
  userId: undefined,
  accessLevel: "unauthenticated",
};

describe("Issue rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows both lines of a row: title, badges, ID, machine, status", () => {
    renderList([makeIssue()], ANONYMOUS);
    const row = within(screen.getByRole("listitem"));

    expect(
      row.getByRole("link", {
        name: "Left flipper weak after the second multiball",
      })
    ).toHaveAttribute("href", "/m/AFM/i/12");
    expect(row.getByTestId("issue-severity")).toHaveTextContent(
      "Severity: Major"
    );
    expect(row.getByTestId("issue-priority")).toHaveTextContent(
      "Priority: High"
    );
    expect(row.getByTestId("issue-id")).toHaveTextContent("AFM-12");
    expect(row.getByRole("link", { name: "Attack from Mars" })).toHaveAttribute(
      "href",
      "/m/AFM"
    );
    expect(row.getByText("In Progress")).toBeInTheDocument();
  });

  it("shows the comment count only when there are comments", () => {
    renderList(
      [
        makeIssue({ id: "a", commentCount: 3 }),
        makeIssue({ id: "b", issueNumber: 13, commentCount: 0 }),
      ],
      ANONYMOUS
    );
    const [withComments, withoutComments] = screen.getAllByRole("listitem");
    if (!withComments || !withoutComments) throw new Error("expected 2 rows");

    expect(
      within(withComments).getByTestId("issue-comment-count")
    ).toHaveTextContent("3 comments");
    expect(
      within(withoutComments).queryByTestId("issue-comment-count")
    ).toBeNull();
  });

  it("announces an unassigned issue as Unassigned and an assignee by name and initials", () => {
    renderList(
      [
        makeIssue({ id: "a" }),
        makeIssue({
          id: "b",
          issueNumber: 13,
          assignedTo: OTHER_ID,
          assignedToUser: { id: OTHER_ID, name: "Priya Shah" },
        }),
      ],
      ANONYMOUS
    );
    const [unassigned, assigned] = screen.getAllByRole("listitem");
    if (!unassigned || !assigned) throw new Error("expected 2 rows");

    // Desktop avatar and phone initials are both in the DOM; CSS shows one.
    expect(
      within(unassigned).getAllByRole("img", { name: "Unassigned" })
    ).toHaveLength(2);
    const avatars = within(assigned).getAllByRole("img", {
      name: "Assigned to Priya Shah",
    });
    expect(avatars).toHaveLength(2);
    for (const avatar of avatars) expect(avatar).toHaveTextContent("PS");
  });
});

describe("Issue row editing permissions (issues-list §3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function editableFields(): string[] {
    const row = within(screen.getByRole("listitem"));
    return [
      ["Status", /^Status: .*, change$/],
      ["Severity", /^Severity: .*, change$/],
      ["Priority", /^Priority: .*, change$/],
      ["Assignee", /, change assignee$/],
    ]
      .filter(([, name]) => row.queryAllByRole("button", { name }).length > 0)
      .map(([field]) => String(field));
  }

  it.each<[string, IssueRowsViewer, string | null, string[]]>([
    ["anonymous visitor", ANONYMOUS, REPORTER_ID, []],
    [
      "guest on their own issue",
      { userId: REPORTER_ID, accessLevel: "guest" },
      REPORTER_ID,
      ["Status", "Severity"],
    ],
    [
      "guest on someone else's issue",
      { userId: REPORTER_ID, accessLevel: "guest" },
      OTHER_ID,
      [],
    ],
    [
      "member",
      { userId: REPORTER_ID, accessLevel: "member" },
      OTHER_ID,
      ["Status", "Severity", "Priority", "Assignee"],
    ],
    [
      "technician",
      { userId: REPORTER_ID, accessLevel: "technician" },
      OTHER_ID,
      ["Status", "Severity", "Priority", "Assignee"],
    ],
  ])("%s", (_label, viewer, reporterId, expected) => {
    renderList(
      [
        makeIssue({
          reportedByUser:
            reporterId === null ? null : { id: reporterId, name: "Rhea" },
        }),
      ],
      viewer
    );
    expect(editableFields()).toEqual(expected);
  });

  it("shows plain values, not buttons, to a viewer who may not edit", () => {
    renderList([makeIssue()], ANONYMOUS);
    const row = within(screen.getByRole("listitem"));
    expect(row.queryByRole("button")).toBeNull();
    expect(row.getByTestId("issue-priority").tagName).toBe("SPAN");
  });

  it("saves a priority picked from the row's menu", async () => {
    mockUpdatePriority.mockResolvedValue({ ok: true, value: undefined });
    const user = userEvent.setup();
    renderList([makeIssue({ priority: "low" })], {
      userId: OTHER_ID,
      accessLevel: "member",
    });

    await user.click(
      screen.getByRole("button", { name: "Priority: Low, change" })
    );
    await user.click(screen.getByRole("menuitemradio", { name: "High" }));

    expect(mockUpdatePriority).toHaveBeenCalledOnce();
    const formData = mockUpdatePriority.mock.calls[0]?.[1];
    if (!(formData instanceof FormData)) throw new Error("expected FormData");
    expect(formData.get("issueId")).toBe("issue-1");
    expect(formData.get("priority")).toBe("high");
    expect(
      await screen.findByRole("button", { name: "Priority: High, change" })
    ).toBeInTheDocument();
  });
});

describe("Issue rows keep their place (issues-list §3.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const first = makeIssue({ id: "a", issueNumber: 1, title: "First" });
  const second = makeIssue({ id: "b", issueNumber: 2, title: "Second" });

  function titles(): string[] {
    return screen
      .getAllByTestId("issue-title")
      .map((link) => link.textContent ?? "");
  }

  function rerenderWith(
    rerender: ReturnType<typeof render>["rerender"],
    issues: IssueListRow[],
    listKey: string
  ): void {
    rerender(
      <IssueViewRows
        rows={issues}
        listKey={listKey}
        users={[]}
        viewer={ANONYMOUS}
      />
    );
  }

  it("keeps rows in place when the same list re-renders reordered or without a row", () => {
    const { rerender } = renderList([first, second], ANONYMOUS, "status=new");

    // The server re-renders after an edit: the edited row now sorts last.
    rerenderWith(
      rerender,
      [{ ...second, title: "Second, edited" }, first],
      "status=new"
    );
    expect(titles()).toEqual(["First", "Second, edited"]);

    // The edited row no longer matches the filters: it stays until reload.
    rerenderWith(rerender, [second], "status=new");
    expect(titles()).toEqual(["First", "Second"]);
  });

  it("takes the server's rows once the list reloads with a new configuration", () => {
    const { rerender } = renderList([first, second], ANONYMOUS, "status=new");

    rerenderWith(rerender, [second], "status=new&sort=created&dir=desc");
    expect(titles()).toEqual(["Second"]);
  });
});
