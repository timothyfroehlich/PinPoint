import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";
import type { IssueWithAllRelations } from "~/lib/types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { IssueActivity } from "~/components/issues/IssueActivity";
import { IssueDetails } from "~/components/issues/IssueDetails";
import { deleteCommentAction } from "~/app/(app)/issues/actions";
import { TooltipProvider } from "~/components/ui/tooltip";

// Wrap renders in TooltipProvider since the global provider lives in the root
// layout (ClientProviders) which is not rendered in unit tests.
function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

vi.mock("~/app/(app)/issues/actions", () => ({
  deleteCommentAction: vi.fn(),
  editCommentAction: vi.fn(),
  assignIssueAction: vi.fn(),
  updateIssueStatusAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  updateIssueFrequencyAction: vi.fn(),
}));

vi.mock("~/app/(app)/issues/watcher-actions", () => ({
  toggleWatcherAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The real editor is a lazy TipTap bundle; a textarea stands in for it.
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({
    ariaLabel,
    autoFocus,
  }: {
    ariaLabel?: string;
    autoFocus?: boolean;
  }) => <textarea aria-label={ariaLabel} autoFocus={autoFocus} />,
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

    // A link to log in that comes back to this issue.
    expect(
      screen.getByRole("link", { name: "Log in to comment" })
    ).toHaveAttribute("href", "/login?next=%2Fm%2FAFM%2Fi%2F1");
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

  it("names the timestamp triggers before hydration without a zone-dependent attribute", () => {
    // Regression (PP-h490). Server HTML must not carry `formatDateTime(...)`
    // in an attribute: it resolves the runtime's zone (UTC on Vercel), and
    // React never patches a mismatched attribute on hydration. The triggers
    // are named by their visible text — the server-built fallback until the
    // ticker mounts — with no aria-label replacing it (WCAG 2.5.3).
    const html = renderToString(
      <TooltipProvider>
        <IssueActivity
          issue={createIssue(withComments(systemEvent, comment))}
          currentUserId="member-1"
          currentUserRole="member"
        />
      </TooltipProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = html;

    const triggers = [...container.querySelectorAll("button")].filter(
      (button) => button.querySelector("time") !== null
    );
    // The system event, the comment, and its edited marker. If this drops,
    // the fixture stopped covering a row and the checks below aren't watching.
    expect(triggers).toHaveLength(3);
    for (const trigger of triggers) {
      expect(trigger.textContent?.trim()).not.toBe("");
      expect(trigger).not.toHaveAttribute("aria-label");
    }
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      systemEvent.createdAt.toISOString()
    );

    // "2:30 PM" is the shape `formatDateTime` produces.
    for (const element of container.querySelectorAll("*")) {
      for (const attribute of element.attributes) {
        expect(attribute.value).not.toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
      }
    }
  });

  it("names each comment by its author and time", () => {
    renderWithProviders(
      <IssueActivity
        issue={createIssue(withComments(comment))}
        currentUserId={null}
        currentUserRole="unauthenticated"
      />
    );
    expect(
      screen.getByRole("article", { name: /^Member User/ })
    ).toBeInTheDocument();
  });

  it("announces what Comments only leaves showing", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <IssueActivity
        issue={createIssue(withComments(systemEvent, comment))}
        currentUserId={null}
        currentUserRole="unauthenticated"
      />
    );
    const toggle = screen.getByRole("button", { name: "Comments only" });

    await user.click(toggle);
    expect(screen.getByText("Showing 1 comment")).toHaveAttribute(
      "role",
      "status"
    );

    await user.click(toggle);
    expect(screen.getByText("Showing all activity")).toHaveAttribute(
      "role",
      "status"
    );
  });

  it("lists entries in order and offers Comments only only when there are entries", () => {
    const { unmount } = renderWithProviders(
      <IssueActivity
        issue={createIssue(withComments(systemEvent, comment))}
        currentUserId={null}
        currentUserRole="unauthenticated"
      />
    );
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    unmount();

    renderWithProviders(
      <IssueActivity
        issue={createIssue()}
        currentUserId={null}
        currentUserRole="unauthenticated"
      />
    );
    expect(
      screen.queryByRole("button", { name: "Comments only" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
  });

  describe("comment actions keep focus on the page", () => {
    function renderOwnComment() {
      renderWithProviders(
        <IssueActivity
          issue={createIssue(withComments(comment))}
          currentUserId="member-1"
          currentUserRole="member"
        />
      );
      return screen.getByRole("button", { name: "Comment actions" });
    }

    it("says which comment the actions button belongs to", () => {
      const trigger = renderOwnComment();
      expect(trigger).toHaveAccessibleDescription(/^Member User/);
    });

    it("Edit focuses the editor; Cancel returns focus to the actions button", async () => {
      const user = userEvent.setup();
      const trigger = renderOwnComment();

      await user.click(trigger);
      await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
      await waitFor(() => {
        expect(
          screen.getByRole("textbox", { name: "Edit comment" })
        ).toHaveFocus();
      });

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it("canceling a delete returns focus to the actions button", async () => {
      const user = userEvent.setup();
      const trigger = renderOwnComment();

      await user.click(trigger);
      await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(deleteCommentAction).not.toHaveBeenCalled();
    });

    it("a completed delete moves focus to the Activity heading", async () => {
      vi.mocked(deleteCommentAction).mockResolvedValue({
        ok: true,
        value: { commentId: "comment-1" },
      });
      const user = userEvent.setup();
      const trigger = renderOwnComment();

      await user.click(trigger);
      await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Activity" })).toHaveFocus();
      });
    });
  });
});
