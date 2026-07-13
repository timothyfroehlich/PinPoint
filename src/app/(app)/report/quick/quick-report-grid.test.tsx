import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
    await userEvent.type(
      screen.getByLabelText(/problem/i),
      "No machine picked"
    );
    await userEvent.click(screen.getByRole("button", { name: /submit all/i }));
    expect(await screen.findByText(/Machine not found/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("No machine picked")).toBeInTheDocument();
  });
});
