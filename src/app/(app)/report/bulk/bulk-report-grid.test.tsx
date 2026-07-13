import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "~/components/ui/tooltip";
import { BulkReportGrid } from "./bulk-report-grid";

const submitRow = vi.fn();
const submitAll = vi.fn();
vi.mock("./actions", () => ({
  submitBulkIssueRowAction: (...a: unknown[]) => submitRow(...a),
  submitBulkIssuesAction: (...a: unknown[]) => submitAll(...a),
}));

const machines = [
  {
    id: "11111111-1111-1111-1111-111111111111",
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
      <BulkReportGrid machines={machines} assignees={assignees} />
    </TooltipProvider>
  );
}

describe("BulkReportGrid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts with one empty row and can add more", async () => {
    renderGrid();
    expect(screen.getAllByTestId("bulk-row")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /add issue/i }));
    expect(screen.getAllByTestId("bulk-row")).toHaveLength(2);
  });

  it("expands and collapses a row", async () => {
    renderGrid();
    const row = screen.getByTestId("bulk-row");
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
    const row = screen.getByTestId("bulk-row");
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
    expect(await screen.findByText(/Created #42/)).toBeInTheDocument();
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
    const row = screen.getByTestId("bulk-row");
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Spinner rejecting"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/Created #42/)).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: /undo/i }));
    await userEvent.type(
      within(row).getByLabelText(/problem/i),
      "Edited after undo"
    );
    await userEvent.click(within(row).getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/Created #43/)).toBeInTheDocument();

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
    expect(screen.getByTestId("bulk-row")).toBeInTheDocument();
  });
});
