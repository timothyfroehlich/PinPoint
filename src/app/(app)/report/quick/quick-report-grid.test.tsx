import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "~/components/ui/tooltip";
import { QuickReportGrid } from "./quick-report-grid";

const submitRow = vi.fn();
const submitAll = vi.fn();
vi.mock("./actions", () => ({
  submitQuickIssueRowAction: (...a: unknown[]) => submitRow(...a),
  submitQuickIssuesAction: (...a: unknown[]) => submitAll(...a),
}));

const machines = [
  {
    value: "11111111-1111-1111-1111-111111111111",
    name: "Grand Prix",
    initials: "GP",
  },
];
const assignees = [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Tim" }];

// StatusSelect renders a Tooltip internally, which requires a TooltipProvider
// ancestor — the real app supplies one via ClientProviders at the root.
function renderGrid(): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <QuickReportGrid machines={machines} assignees={assignees} />
    </TooltipProvider>
  );
}

describe("QuickReportGrid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts with one empty row and can add more", async () => {
    renderGrid();
    expect(screen.getAllByTestId("quick-row")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /add issue/i }));
    expect(screen.getAllByTestId("quick-row")).toHaveLength(2);
  });

  it("expands and collapses a row", async () => {
    renderGrid();
    const row = screen.getByTestId("quick-row");
    expect(within(row).queryByText(/description/i)).not.toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: /more/i }));
    expect(within(row).getByText(/description/i)).toBeInTheDocument();
  });

  it("quick-submits a row and shows the confirmation strip", async () => {
    submitRow.mockResolvedValue({
      index: 0,
      ok: true,
      issueNumber: 42,
      machineInitials: "GP",
    });
    renderGrid();
    const row = screen.getByTestId("quick-row");
    // machine + problem
    await userEvent.click(
      within(row).getByRole("combobox", { name: /machine/i })
    );
    await userEvent.click(screen.getByText(/Grand Prix/));
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    expect(
      await screen.findByRole("link", { name: "GP-42" })
    ).toBeInTheDocument();
  });

  it("opens a new blank row automatically after a successful quick-submit", async () => {
    submitRow.mockResolvedValue({
      index: 0,
      ok: true,
      issueNumber: 42,
      machineInitials: "GP",
    });
    renderGrid();
    const row = screen.getByTestId("quick-row");
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    await screen.findByRole("link", { name: "GP-42" });
    expect(screen.getAllByTestId("quick-row")).toHaveLength(2);
    expect(screen.getByLabelText(/problem/i)).toHaveValue("");
  });

  it("marks Machine and Problem as required fields", () => {
    renderGrid();
    const row = screen.getByTestId("quick-row");
    expect(within(row).getByText("Machine")).toBeInTheDocument();
    const machineLabel = within(row).getByText("Machine").closest("label");
    expect(machineLabel).toHaveTextContent("*");
    const problemLabel = within(row)
      .getByText("Problem (issue title)")
      .closest("label");
    expect(problemLabel).toHaveTextContent("*");
  });

  it("rotates the idempotency key on undo so a re-edited resubmit isn't deduped", async () => {
    submitRow
      .mockResolvedValueOnce({
        index: 0,
        ok: true,
        issueNumber: 42,
        machineInitials: "GP",
      })
      .mockResolvedValueOnce({
        index: 0,
        ok: true,
        issueNumber: 43,
        machineInitials: "GP",
      });
    renderGrid();
    const row = screen.getByTestId("quick-row");
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    expect(
      await screen.findByRole("link", { name: "GP-42" })
    ).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: /undo/i }));
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Edited after undo"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    expect(
      await screen.findByRole("link", { name: "GP-43" })
    ).toBeInTheDocument();

    const [firstCall, secondCall] = submitRow.mock.calls;
    expect(firstCall?.[0].idempotencyKey).not.toBe(
      secondCall?.[0].idempotencyKey
    );
  });

  it("keeps a bad row flagged after submit-all partial failure", async () => {
    // The row is client-ready (machine + problem both filled) so submit-all
    // fires it; the *server* rejects it (e.g. the machine was removed), and
    // that per-row failure must map back to keep this row flagged.
    submitAll.mockResolvedValue({
      ok: true,
      results: [
        {
          index: 0,
          ok: false,
          error: "Machine not found — pick one from the list",
        },
      ],
    });
    renderGrid();
    const row = screen.getByTestId("quick-row");
    await userEvent.click(
      within(row).getByRole("combobox", { name: /machine/i })
    );
    await userEvent.click(screen.getByText(/Grand Prix/));
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Server rejects this"
    );
    await userEvent.click(screen.getByRole("button", { name: /submit all/i }));
    expect(await screen.findByText(/Machine not found/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Server rejects this")).toBeInTheDocument();
  });

  it("recovers from a thrown submit action instead of hanging", async () => {
    submitRow.mockRejectedValue(new Error("network down"));
    renderGrid();
    const row = screen.getByTestId("quick-row");
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    expect(
      await screen.findByText(/something went wrong/i)
    ).toBeInTheDocument();
    // Spinner cleared — the row is retryable, not stuck on "Submitting…".
    expect(
      within(row).getByRole("button", { name: /^submit$/i })
    ).not.toBeDisabled();
  });

  it("quick-submits the row when Enter is pressed in the problem field", async () => {
    submitRow.mockResolvedValue({
      index: 0,
      ok: true,
      issueNumber: 42,
      machineInitials: "GP",
    });
    renderGrid();
    const row = screen.getByTestId("quick-row");
    await userEvent.click(
      within(row).getByRole("combobox", { name: /machine/i })
    );
    await userEvent.click(screen.getByText(/Grand Prix/));
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting{Enter}"
    );
    expect(
      await screen.findByRole("link", { name: "GP-42" })
    ).toBeInTheDocument();
  });

  it("moves focus to the next blank row's machine picker after a submit", async () => {
    submitRow.mockResolvedValue({
      index: 0,
      ok: true,
      issueNumber: 42,
      machineInitials: "GP",
    });
    renderGrid();
    const row = screen.getByTestId("quick-row");
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    await screen.findByRole("link", { name: "GP-42" });
    // The submitted row is now a confirmation strip (no picker); the only
    // machine combobox left is the trailing blank row's, and it should be
    // focused so keyboard authoring flows straight into the next issue.
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /machine/i })).toHaveFocus()
    );
  });

  it("guards against navigating away only while a row has unsaved content", async () => {
    submitRow.mockResolvedValue({
      index: 0,
      ok: true,
      issueNumber: 42,
      machineInitials: "GP",
    });
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    renderGrid();
    const row = screen.getByTestId("quick-row");
    // A pristine blank grid arms no guard.
    expect(addSpy).not.toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
    // Typing content arms the beforeunload guard.
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    // Submitting saves the work and leaves an empty trailing row — guard clears.
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    await screen.findByRole("link", { name: "GP-42" });
    await waitFor(() =>
      expect(removeSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function)
      )
    );
  });

  it("confirms before discarding a row that has content, then removes it", async () => {
    renderGrid();
    const firstRow = screen.getByTestId("quick-row");
    await userEvent.type(
      within(firstRow).getByLabelText(/problem/i),
      "First problem"
    );
    await userEvent.click(screen.getByRole("button", { name: /add issue/i }));
    expect(screen.getAllByTestId("quick-row")).toHaveLength(2);

    const rowToDiscard = screen.getAllByTestId("quick-row")[0];
    await userEvent.click(
      within(rowToDiscard).getByRole("button", { name: /discard/i })
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Discard" })
    );

    await waitFor(() =>
      expect(screen.getAllByTestId("quick-row")).toHaveLength(1)
    );
    expect(screen.queryByDisplayValue("First problem")).not.toBeInTheDocument();
  });

  it("counts a row as ready only once both required fields are filled", async () => {
    renderGrid();
    const row = screen.getByTestId("quick-row");
    const submitAllBtn = screen.getByRole("button", { name: /submit all/i });
    // A problem alone (no machine) is not submittable — must not count as ready.
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Only a problem"
    );
    expect(submitAllBtn).toBeDisabled();
    // Picking the machine completes the row → now ready.
    await userEvent.click(
      within(row).getByRole("combobox", { name: /machine/i })
    );
    await userEvent.click(screen.getByText(/Grand Prix/));
    expect(
      screen.getByRole("button", { name: /submit all \(1\)/i })
    ).toBeEnabled();
  });

  it("clears a row's validation error when the offending field is edited", async () => {
    submitRow.mockResolvedValue({
      index: 0,
      ok: false,
      error: "Please select a machine",
    });
    renderGrid();
    const row = screen.getByTestId("quick-row");
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Weak flipper"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    expect(
      await screen.findByText(/please select a machine/i)
    ).toBeInTheDocument();
    // Editing a required field (the title) drops the stale error immediately.
    await userEvent.type(within(row).getByLabelText(/problem/i), " now");
    expect(
      screen.queryByText(/please select a machine/i)
    ).not.toBeInTheDocument();
  });

  it("keeps an editable blank row after discarding the last unsubmitted row", async () => {
    submitRow.mockResolvedValue({
      index: 0,
      ok: true,
      issueNumber: 42,
      machineInitials: "GP",
    });
    renderGrid();
    const row = screen.getByTestId("quick-row");
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    await screen.findByRole("link", { name: "GP-42" });
    // Discard the trailing blank (empty → no confirm). A fresh blank must
    // remain so the user still has somewhere to type.
    await userEvent.click(screen.getByRole("button", { name: /discard/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/problem/i)).toHaveValue("")
    );
    expect(screen.getByRole("link", { name: "GP-42" })).toBeInTheDocument();
  });
});
