import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";
import type { IssueWithAllRelations } from "~/lib/types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { IssueActivity } from "~/components/issues/IssueActivity";
import { IssueDetails } from "~/components/issues/IssueDetails";
import { TooltipProvider } from "~/components/ui/tooltip";

// Wrap renders in TooltipProvider since the global provider lives in the root
// layout (ClientProviders) which is not rendered in unit tests.
function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

vi.mock("~/app/(app)/issues/actions", () => ({
  assignIssueAction: vi.fn(),
  updateIssueStatusAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  updateIssueFrequencyAction: vi.fn(),
}));

vi.mock("~/app/(app)/issues/watcher-actions", () => ({
  toggleWatcherAction: vi.fn(),
}));

vi.mock("~/components/issues/AddCommentForm", () => ({
  AddCommentForm: () => <div data-testid="mock-add-comment-form" />,
}));

function createIssue(
  overrides?: Partial<IssueWithAllRelations>
): IssueWithAllRelations {
  const description: ProseMirrorDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Left flipper is stuck up." }],
      },
    ],
  };
  return {
    id: "issue-1",
    machineInitials: "AFM",
    issueNumber: 1,
    title: "Flipper stuck",
    description,
    status: "new",
    severity: "major",
    priority: "medium",
    frequency: "frequent",
    reportedBy: "reporter-1",
    invitedReportedBy: null,
    reporterName: null,
    assignedTo: "assignee-1",
    idempotencyKey: null,
    closedAt: null,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    machine: {
      id: "machine-1",
      name: "Attack from Mars",
      ownerRequirements: null,
      owner: { id: "owner-1", name: "Owner One" },
      invitedOwner: null,
    },
    reportedByUser: { id: "reporter-1", name: "Reporter One" },
    invitedReporter: null,
    assignedToUser: { id: "assignee-1", name: "Assignee One" },
    comments: [],
    watchers: [{ userId: "watcher-1" }],
    images: [],
    ...overrides,
  };
}

const systemEvent = {
  id: "event-1",
  isSystem: true,
  author: { id: "member-1", name: "Member User" },
  content: null,
  eventData: { type: "status_changed", from: "new", to: "fixed" },
  images: [],
  createdAt: new Date("2026-02-02T14:30:00.000Z"),
  updatedAt: new Date("2026-02-02T14:30:00.000Z"),
};

const comment = {
  id: "comment-1",
  isSystem: false,
  author: { id: "member-1", name: "Member User" },
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
  },
  eventData: null,
  images: [],
  createdAt: new Date("2026-02-03T14:30:00.000Z"),
  updatedAt: new Date("2026-02-03T15:45:00.000Z"),
};

function withComments(...comments: unknown[]): Partial<IssueWithAllRelations> {
  return { comments: comments as IssueWithAllRelations["comments"] };
}

const allUsers = [{ id: "assignee-1", name: "Assignee One" }];

function renderDetails(
  accessLevel: "unauthenticated" | "guest" | "member",
  ownershipContext: Parameters<typeof IssueDetails>[0]["ownershipContext"],
  currentUserId: string | null
) {
  return renderWithProviders(
    <IssueDetails
      issue={createIssue()}
      allUsers={allUsers}
      currentUserId={currentUserId}
      accessLevel={accessLevel}
      ownershipContext={ownershipContext}
    />
  );
}

const FIELDS = ["Status", "Severity", "Priority", "Frequency", "Assignee"];

function editableFields(): string[] {
  return FIELDS.filter(
    (field) =>
      screen.queryByRole("button", { name: new RegExp(`^${field}: `) }) !== null
  );
}

describe("Issue detail Details (spec §3, §9)", () => {
  it("shows every field read-only to a signed-out visitor, with the watcher count but no Watch toggle", () => {
    renderDetails("unauthenticated", {}, null);

    expect(editableFields()).toEqual([]);
    expect(screen.getByText("Assignee One")).toBeInTheDocument();
    const watching = screen.getByTestId("details-watching");
    expect(within(watching).getByTestId("watcher-count")).toHaveTextContent(
      "1"
    );
    expect(within(watching).queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets a member change every field", () => {
    renderDetails(
      "member",
      { userId: "member-1", reporterId: "reporter-1" },
      "member-1"
    );
    expect(editableFields()).toEqual(FIELDS);
  });

  it("lets a guest change only the reporting fields, only on their own issue", () => {
    const { unmount } = renderDetails(
      "guest",
      { userId: "guest-1", reporterId: "guest-1" },
      "guest-1"
    );
    expect(editableFields()).toEqual(["Status", "Severity", "Frequency"]);
    unmount();

    renderDetails(
      "guest",
      { userId: "guest-1", reporterId: "reporter-1" },
      "guest-1"
    );
    expect(editableFields()).toEqual([]);
  });

  it("shows the context rows in order, linking the owner to their machines' issues", () => {
    renderDetails("unauthenticated", {}, null);

    const rows = screen.getByTestId("issue-context-rows");
    expect(
      [...rows.children].map((row) => row.firstElementChild?.textContent)
    ).toEqual(["Machine", "Owner", "Reported", "Updated", "Watching"]);
    expect(
      within(screen.getByTestId("details-owner")).getByRole("link", {
        name: "Owner One",
      })
    ).toHaveAttribute("href", "/issues?owner=owner-1");
    expect(
      within(screen.getByTestId("details-reported")).getByText("Reporter One")
    ).toBeInTheDocument();
  });
});

describe("Issue detail Activity (spec §7–§8)", () => {
  it("shows a login prompt instead of the comment box when signed out", () => {
    renderWithProviders(
      <IssueActivity
        issue={createIssue()}
        currentUserId={null}
        currentUserRole="unauthenticated"
      />
    );

    expect(screen.getByText("Log in to comment")).toBeInTheDocument();
    expect(
      screen.queryByTestId("mock-add-comment-form")
    ).not.toBeInTheDocument();
  });

  it.each(["guest", "member"] as const)(
    "shows the comment box, not the login prompt, to a signed-in %s",
    (role) => {
      renderWithProviders(
        <IssueActivity
          issue={createIssue()}
          currentUserId={`${role}-1`}
          currentUserRole={role}
        />
      );

      expect(screen.queryByText("Log in to comment")).not.toBeInTheDocument();
      expect(screen.getByTestId("mock-add-comment-form")).toBeInTheDocument();
    }
  );

  it("writes a system event as one line: who, what changed, when", () => {
    renderWithProviders(
      <IssueActivity
        issue={createIssue(withComments(systemEvent))}
        currentUserId={null}
        currentUserRole="unauthenticated"
      />
    );

    const row = screen.getByTestId("timeline-item-event-1");
    expect(row).toHaveAttribute("id", "comment-event-1");
    expect(row).toHaveTextContent("Member User changed status New → Fixed");
  });

  it("shows the empty state while there are no comments, even with system events", () => {
    renderWithProviders(
      <IssueActivity
        issue={createIssue(withComments(systemEvent))}
        currentUserId={null}
        currentUserRole="unauthenticated"
      />
    );
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
  });

  it("Comments only hides system events and starts off", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <IssueActivity
        issue={createIssue(withComments(systemEvent, comment))}
        currentUserId={null}
        currentUserRole="unauthenticated"
      />
    );
    const toggle = screen.getByRole("button", { name: "Comments only" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("timeline-item-event-1")).toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByTestId("timeline-item-event-1")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("timeline-item-comment-1")).toBeInTheDocument();
  });

  it("names the timestamp triggers without a zone-dependent SSR attribute", () => {
    // Regression (PP-h490). The buttons need an accessible name while
    // `<RelativeTime>` is still empty (axe `button-name`), and that name must
    // not be `formatDateTime(...)` evaluated during SSR: it resolves the
    // runtime's zone, and React never patches a mismatched attribute. The
    // server snapshot of the shared ticker is `null`, so this asserts the
    // pre-tick label.
    const html = renderToString(
      <TooltipProvider>
        <IssueActivity
          issue={createIssue(withComments(systemEvent, comment))}
          currentUserId="member-1"
          currentUserRole="member"
        />
      </TooltipProvider>
    );

    const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
    // One for the system event, one for the comment. If this drops, the
    // fixture stopped covering a row and the assertion below isn't watching.
    expect(labels.filter((l) => l === "Show exact time")).toHaveLength(2);
    // "2:30 PM" is the shape `formatDateTime` produces.
    for (const label of labels) {
      expect(label).not.toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    }
  });
});
