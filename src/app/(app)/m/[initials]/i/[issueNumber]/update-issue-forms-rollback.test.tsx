import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { toast } from "sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
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

// Mock useActionState so we can drive [state, action, isPending] across renders.
// The form's optimistic-rollback fix runs inside a useEffect on `state`, so we
// need to flip from `undefined` to an error payload between renders.
const mockUseActionState = vi.fn();
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: (fn: unknown, initialState: unknown) =>
      mockUseActionState(fn, initialState),
  };
});

const ownershipContext = {
  userId: "user-1",
  reporterId: "user-1",
  machineOwnerId: null,
};

interface RollbackCase {
  name: string;
  // Render a form with `currentValue` as its initial prop.
  renderInitial: (currentValue: string) => React.ReactElement;
  // Re-render the form with the same prop but with an error state injected.
  initialValue: string;
  bumpedValue: string;
  /** aria-label substring that proves the trigger reflects `value`. */
  ariaLabelFor: (value: string) => string;
  /** Hidden-input `name=` attribute used by the form. */
  hiddenInputName: string;
}

const cases: RollbackCase[] = [
  {
    name: "UpdateIssueStatusForm",
    initialValue: "new",
    bumpedValue: "in_progress",
    renderInitial: (currentValue) => (
      <UpdateIssueStatusForm
        issueId="issue-1"
        currentStatus={currentValue as never}
        accessLevel="member"
        ownershipContext={ownershipContext}
      />
    ),
    ariaLabelFor: (value) =>
      value === "new" ? "Status: New" : "Status: In Progress",
    hiddenInputName: "status",
  },
  {
    name: "UpdateIssuePriorityForm",
    initialValue: "low",
    bumpedValue: "high",
    renderInitial: (currentValue) => (
      <UpdateIssuePriorityForm
        issueId="issue-1"
        currentPriority={currentValue as never}
        accessLevel="member"
        ownershipContext={ownershipContext}
      />
    ),
    ariaLabelFor: (value) =>
      value === "low" ? "Priority: Low" : "Priority: High",
    hiddenInputName: "priority",
  },
  {
    name: "UpdateIssueSeverityForm",
    initialValue: "minor",
    bumpedValue: "major",
    renderInitial: (currentValue) => (
      <UpdateIssueSeverityForm
        issueId="issue-1"
        currentSeverity={currentValue as never}
        accessLevel="member"
        ownershipContext={ownershipContext}
      />
    ),
    ariaLabelFor: (value) =>
      value === "minor" ? "Severity: Minor" : "Severity: Major",
    hiddenInputName: "severity",
  },
  {
    name: "UpdateIssueFrequencyForm",
    initialValue: "intermittent",
    bumpedValue: "frequent",
    renderInitial: (currentValue) => (
      <UpdateIssueFrequencyForm
        issueId="issue-1"
        currentFrequency={currentValue as never}
        accessLevel="member"
        ownershipContext={ownershipContext}
      />
    ),
    ariaLabelFor: (value) =>
      value === "intermittent"
        ? "Frequency: Intermittent"
        : "Frequency: Frequent",
    hiddenInputName: "frequency",
  },
];

function renderWithProviders(ui: React.ReactElement): {
  rerender: (ui: React.ReactElement) => void;
} {
  const result = render(<TooltipProvider>{ui}</TooltipProvider>);
  return {
    rerender: (next) =>
      result.rerender(<TooltipProvider>{next}</TooltipProvider>),
  };
}

describe("inline metadata forms: optimistic rollback on action error (PP-hob)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: action has not yet returned (`state` is undefined).
    mockUseActionState.mockReturnValue([undefined, vi.fn(), false]);
  });

  for (const tc of cases) {
    it(`${tc.name} renders initial value`, () => {
      renderWithProviders(tc.renderInitial(tc.initialValue));
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-label",
        tc.ariaLabelFor(tc.initialValue)
      );
      // Hidden input matches initial prop.
      expect(
        document.querySelector(`input[name="${tc.hiddenInputName}"]`)
      ).toHaveAttribute("value", tc.initialValue);
    });

    it(`${tc.name} rolls back hidden-input value and toasts when the action errors`, async () => {
      const { rerender } = renderWithProviders(
        tc.renderInitial(tc.initialValue)
      );

      // Simulate the user picking a new value by re-rendering the same form
      // with a manually-driven state transition: we cannot easily script the
      // Radix Select dropdown in jsdom, so we instead exercise the rollback
      // path by (1) confirming initial state, (2) toggling useActionState to
      // an error payload, and (3) asserting the post-error UI.
      //
      // To prove rollback rather than "value never changed", we first force
      // selectedX to diverge by dispatching the action's error WHILE the
      // hidden input still reflects the initial value, then check that the
      // hidden input remains at initialValue AFTER the rollback effect runs
      // (i.e. setSelectedX(currentX) is a no-op visually but the effect ran
      // and called toast.error). The stronger divergence case is covered by
      // the dedicated "after a value change" test below.
      mockUseActionState.mockReturnValue([
        { ok: false, message: "Permission denied" },
        vi.fn(),
        false,
      ]);
      rerender(tc.renderInitial(tc.initialValue));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Permission denied");
      });
      // After rollback, selectedX === currentX === initialValue.
      expect(
        document.querySelector(`input[name="${tc.hiddenInputName}"]`)
      ).toHaveAttribute("value", tc.initialValue);
    });

    it(`${tc.name} resets divergent selectedX back to currentX when error arrives`, async () => {
      // Render with currentX = initialValue. The form's internal useState
      // captures initialValue. We then re-render with currentX = bumpedValue
      // (simulating that the server briefly accepted the change before a
      // *different* operation surfaced an error). After the error, the form
      // must converge on the current prop value.
      //
      // This case differs from the previous test: here selectedX (state) was
      // last set to initialValue, and currentX (prop) is now bumpedValue, so
      // setSelectedX(currentX) actually changes the rendered value.
      const { rerender } = renderWithProviders(
        tc.renderInitial(tc.initialValue)
      );
      // Re-render with new prop (no error yet, just a fresh prop).
      mockUseActionState.mockReturnValue([undefined, vi.fn(), false]);
      rerender(tc.renderInitial(tc.bumpedValue));
      // Selected state stays at initialValue (useState ignores prop changes),
      // hidden input still shows initialValue.
      expect(
        document.querySelector(`input[name="${tc.hiddenInputName}"]`)
      ).toHaveAttribute("value", tc.initialValue);

      // Now the action errors. useEffect fires setSelectedX(currentX=bumpedValue).
      mockUseActionState.mockReturnValue([
        { ok: false, message: "boom" },
        vi.fn(),
        false,
      ]);
      rerender(tc.renderInitial(tc.bumpedValue));

      await waitFor(() => {
        expect(
          document.querySelector(`input[name="${tc.hiddenInputName}"]`)
        ).toHaveAttribute("value", tc.bumpedValue);
      });
      expect(toast.error).toHaveBeenCalledWith("boom");
    });
  }
});
