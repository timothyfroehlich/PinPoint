/**
 * Permanent regression guard for a confirmed production bug (PP-0fvr,
 * root-caused from prod logs):
 *
 * @radix-ui/react-select 2.3.3 added a form-`reset` listener inside the
 * Select root that calls `setValue(initialValueRef.current)` — a
 * `useControllableState` setter, which invokes `onValueChange`. React 19
 * automatically fires a `reset` event on a `<form action={...}>` once the
 * action settles. The four inline metadata forms
 * (`update-issue-{status,priority,severity,frequency}-form.tsx`) used to
 * wire `onValueChange` straight into `form.requestSubmit()`, so Radix's
 * reset-driven `onValueChange` looked exactly like a real user selection
 * and fired a SECOND submit carrying the form's ORIGINAL value — silently
 * reverting every status/priority/severity/frequency change about a second
 * after it was made.
 *
 * The fix: these forms no longer route through native `<form>` submission
 * at all. `handleValueChange` builds `FormData` itself and calls the
 * `useActionState` dispatch directly inside `startTransition`. Because no
 * form submission ever occurs, React never auto-resets the form, so
 * Radix's reset listener never fires and the second write can't happen.
 *
 * This test renders each real form (no mock of `react` or `useActionState`
 * — the whole point is to let React 19's real post-action form-reset
 * mechanics run) and drives a real selection through the Radix Select for
 * all four fields, table-driven (mirrors the table in
 * `update-issue-forms-rollback.test.tsx`).
 *
 * Expected (fixed): each action called exactly ONCE, with the newly
 * selected value. Before the fix (on @radix-ui/react-select 2.3.3, with
 * the old `form.requestSubmit()` dance), this test failed with each action
 * called TWICE — once with the real selection, once with the form's
 * original value.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";
import { UpdateIssuePriorityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form";
import { UpdateIssueSeverityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-severity-form";
import { UpdateIssueFrequencyForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-frequency-form";
import {
  updateIssueStatusAction,
  updateIssuePriorityAction,
  updateIssueSeverityAction,
  updateIssueFrequencyAction,
} from "~/app/(app)/issues/actions";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("~/app/(app)/issues/actions", () => ({
  updateIssueStatusAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssueFrequencyAction: vi.fn(),
}));

const ownershipContext = {
  userId: "user-1",
  reporterId: "user-1",
  machineOwnerId: null,
};

interface RevertCase {
  name: string;
  action: ReturnType<typeof vi.fn>;
  fieldName: string;
  newOptionLabel: string;
  newValue: string;
  render: () => React.ReactElement;
}

const cases: RevertCase[] = [
  {
    name: "UpdateIssueStatusForm",
    action: vi.mocked(updateIssueStatusAction),
    fieldName: "status",
    newOptionLabel: "Fixed",
    newValue: "fixed",
    render: () => (
      <UpdateIssueStatusForm
        issueId="issue-1"
        currentStatus="new"
        accessLevel="member"
        ownershipContext={ownershipContext}
      />
    ),
  },
  {
    name: "UpdateIssuePriorityForm",
    action: vi.mocked(updateIssuePriorityAction),
    fieldName: "priority",
    newOptionLabel: "High",
    newValue: "high",
    render: () => (
      <UpdateIssuePriorityForm
        issueId="issue-1"
        currentPriority="low"
        accessLevel="member"
        ownershipContext={ownershipContext}
      />
    ),
  },
  {
    name: "UpdateIssueSeverityForm",
    action: vi.mocked(updateIssueSeverityAction),
    fieldName: "severity",
    newOptionLabel: "Major",
    newValue: "major",
    render: () => (
      <UpdateIssueSeverityForm
        issueId="issue-1"
        currentSeverity="minor"
        accessLevel="member"
        ownershipContext={ownershipContext}
      />
    ),
  },
  {
    name: "UpdateIssueFrequencyForm",
    action: vi.mocked(updateIssueFrequencyAction),
    fieldName: "frequency",
    newOptionLabel: "Frequent",
    newValue: "frequent",
    render: () => (
      <UpdateIssueFrequencyForm
        issueId="issue-1"
        currentFrequency="intermittent"
        accessLevel="member"
        ownershipContext={ownershipContext}
      />
    ),
  },
];

describe("inline metadata forms: no Radix reset-driven revert (PP-0fvr)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const tc of cases) {
      tc.action.mockResolvedValue({ ok: true, value: { issueId: "issue-1" } });
    }
  });

  for (const tc of cases) {
    it(`${tc.name} submits exactly once with the selected ${tc.fieldName}, not twice with a reverted value`, async () => {
      const user = userEvent.setup();

      render(<TooltipProvider>{tc.render()}</TooltipProvider>);

      // Open the Select and pick the new option — a real user interaction,
      // not a scripted state transition.
      await user.click(screen.getByRole("combobox"));
      await user.click(screen.getByRole("option", { name: tc.newOptionLabel }));

      // Wait for the (mocked) action to have been invoked and the pending
      // state to settle, giving React 19's automatic post-action form
      // reset a chance to fire if the bug is present.
      await waitFor(() => {
        expect(tc.action).toHaveBeenCalled();
      });

      // Give any reset-driven second submit time to land.
      await new Promise((resolve) => setTimeout(resolve, 200));

      const calls = tc.action.mock.calls;
      const values = calls.map((call) => {
        const formData = call[1];
        if (!(formData instanceof FormData)) {
          throw new Error("Expected FormData as the action's second argument");
        }
        return formData.get(tc.fieldName);
      });

      expect(values).toEqual([tc.newValue]);
      expect(tc.action).toHaveBeenCalledTimes(1);
    });
  }
});
