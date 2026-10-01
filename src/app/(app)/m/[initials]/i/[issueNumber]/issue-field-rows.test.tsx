/**
 * The Details field rows (spec issue-detail §3.7, §9.1–§9.2), driven the way a
 * person drives them: open the row, pick a value. `useActionState` is real, so
 * this also guards PP-0fvr — a stale value replayed after React 19's
 * post-action form reset — by asserting each choice saves exactly once.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type React from "react";
import { toast } from "sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import {
  updateIssueStatusAction,
  updateIssuePriorityAction,
  updateIssueSeverityAction,
  updateIssueFrequencyAction,
} from "~/app/(app)/issues/actions";
import type { AccessLevel } from "~/lib/permissions/matrix";
import type { OwnershipContext } from "~/lib/permissions/helpers";
import { UpdateIssueStatusForm } from "./update-issue-status-form";
import { UpdateIssuePriorityForm } from "./update-issue-priority-form";
import { UpdateIssueSeverityForm } from "./update-issue-severity-form";
import { UpdateIssueFrequencyForm } from "./update-issue-frequency-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("~/app/(app)/issues/actions", () => ({
  updateIssueStatusAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssueFrequencyAction: vi.fn(),
}));

const reporter: OwnershipContext = { userId: "user-1", reporterId: "user-1" };

interface RowCase {
  label: string;
  fieldName: string;
  action: ReturnType<typeof vi.fn>;
  fromLabel: string;
  toLabel: string;
  toValue: string;
  render: (
    access: AccessLevel,
    ownership: OwnershipContext
  ) => React.ReactElement;
}

const cases: RowCase[] = [
  {
    label: "Status",
    fieldName: "status",
    action: vi.mocked(updateIssueStatusAction),
    fromLabel: "New",
    toLabel: "Fixed",
    toValue: "fixed",
    render: (accessLevel, ownershipContext) => (
      <UpdateIssueStatusForm
        issueId="issue-1"
        currentStatus="new"
        accessLevel={accessLevel}
        ownershipContext={ownershipContext}
      />
    ),
  },
  {
    label: "Priority",
    fieldName: "priority",
    action: vi.mocked(updateIssuePriorityAction),
    fromLabel: "Low",
    toLabel: "High",
    toValue: "high",
    render: (accessLevel, ownershipContext) => (
      <UpdateIssuePriorityForm
        issueId="issue-1"
        currentPriority="low"
        accessLevel={accessLevel}
        ownershipContext={ownershipContext}
      />
    ),
  },
  {
    label: "Severity",
    fieldName: "severity",
    action: vi.mocked(updateIssueSeverityAction),
    fromLabel: "Minor",
    toLabel: "Major",
    toValue: "major",
    render: (accessLevel, ownershipContext) => (
      <UpdateIssueSeverityForm
        issueId="issue-1"
        currentSeverity="minor"
        accessLevel={accessLevel}
        ownershipContext={ownershipContext}
      />
    ),
  },
  {
    label: "Frequency",
    fieldName: "frequency",
    action: vi.mocked(updateIssueFrequencyAction),
    fromLabel: "Intermittent",
    toLabel: "Frequent",
    toValue: "frequent",
    render: (accessLevel, ownershipContext) => (
      <UpdateIssueFrequencyForm
        issueId="issue-1"
        currentFrequency="intermittent"
        accessLevel={accessLevel}
        ownershipContext={ownershipContext}
      />
    ),
  },
];

function renderRow(ui: React.ReactElement): void {
  render(<TooltipProvider>{ui}</TooltipProvider>);
}

async function choose(tc: RowCase): Promise<void> {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: `${tc.label}: ${tc.fromLabel}` })
  );
  await user.click(
    await screen.findByRole("menuitemradio", { name: tc.toLabel })
  );
}

function submittedValues(tc: RowCase): unknown[] {
  return tc.action.mock.calls.map((call: unknown[]) => {
    const formData = call[1];
    if (!(formData instanceof FormData)) {
      throw new Error("Expected FormData as the action's second argument");
    }
    return formData.get(tc.fieldName);
  });
}

describe("issue Details field rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const tc of cases) {
    it(`${tc.label}: a choice saves once, with the chosen value`, async () => {
      tc.action.mockResolvedValue({ ok: true, value: { issueId: "issue-1" } });
      renderRow(tc.render("member", reporter));

      await choose(tc);

      // The save is announced politely once it lands.
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          `${tc.label} changed to ${tc.toLabel}`
        );
      });
      const row = screen.getByRole("button", {
        name: `${tc.label}: ${tc.toLabel}`,
      });
      expect(row).not.toHaveAttribute("aria-busy");
      // Let any straggling reset-driven second submit land (PP-0fvr).
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(submittedValues(tc)).toEqual([tc.toValue]);
    });

    it(`${tc.label}: a failed save returns the row to its previous value`, async () => {
      tc.action.mockResolvedValue({
        ok: false,
        code: "SERVER",
        message: "Could not save",
      });
      renderRow(tc.render("member", reporter));

      await choose(tc);

      expect(
        await screen.findByRole("button", {
          name: `${tc.label}: ${tc.fromLabel}`,
        })
      ).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith("Could not save");
      // A toast alone is easy to miss: the error also shows under the row.
      expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    });

    it(`${tc.label}: a signed-out viewer sees the value with no control`, () => {
      renderRow(tc.render("unauthenticated", {}));

      expect(screen.getByText(tc.fromLabel)).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  }

  it("a guest can change status on their own issue but not on someone else's", () => {
    const { unmount } = render(
      <TooltipProvider>
        <UpdateIssueStatusForm
          issueId="issue-1"
          currentStatus="new"
          accessLevel="guest"
          ownershipContext={{ userId: "guest-1", reporterId: "guest-1" }}
        />
      </TooltipProvider>
    );
    expect(
      screen.getByRole("button", { name: "Status: New" })
    ).toBeInTheDocument();
    unmount();

    renderRow(
      <UpdateIssueStatusForm
        issueId="issue-1"
        currentStatus="new"
        accessLevel="guest"
        ownershipContext={{ userId: "guest-1", reporterId: "reporter-1" }}
      />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // §3.7: no reason text for a field the viewer can't change.
    expect(screen.queryByText(/only the owner/i)).not.toBeInTheDocument();
  });

  it("priority needs triage: a guest reporter cannot change it", () => {
    renderRow(
      <UpdateIssuePriorityForm
        issueId="issue-1"
        currentPriority="low"
        accessLevel="guest"
        ownershipContext={{ userId: "guest-1", reporterId: "guest-1" }}
      />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("the status menu groups statuses as Open, In Progress, and Closed", async () => {
    const user = userEvent.setup();
    renderRow(
      <UpdateIssueStatusForm
        issueId="issue-1"
        currentStatus="new"
        accessLevel="member"
        ownershipContext={reporter}
      />
    );
    await user.click(screen.getByRole("button", { name: "Status: New" }));

    // "In Progress" is both a group and a status, so read the group labels.
    await screen.findByRole("menu");
    const groups = [
      ...document.querySelectorAll('[data-slot="dropdown-menu-label"]'),
    ].map((label) => label.textContent);
    expect(groups).toEqual(["Open", "In Progress", "Closed"]);
  });
});
