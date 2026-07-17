import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { randomUUID } from "node:crypto";
import { usePathname } from "next/navigation";
import { ReportTabs } from "./report-tabs";
import { ReportDraftProvider } from "./report-draft-store";
import {
  serializeDraft,
  defaultEntry,
  emptySingle,
  DRAFT_VERSION,
  REPORT_DRAFT_KEY,
  type ReportDraft,
} from "./report-draft-schema";
import type { MachineOption } from "~/components/machines/MachineCombobox";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/report"),
}));

const MACHINE_A = randomUUID();
const MACHINE_B = randomUUID();
const machines: MachineOption[] = [
  { value: MACHINE_A, name: "Medieval Madness", initials: "MM" },
  { value: MACHINE_B, name: "Twilight Zone", initials: "TZ" },
];

/** Seed a draft with `n` content rows (machine + title) so the provider
 *  hydrates a contentRowCount of `n`. */
function seedContentRows(n: number): void {
  const entries = Array.from({ length: n }, (_, i) => ({
    ...defaultEntry(randomUUID()),
    machineId: i === 0 ? MACHINE_A : MACHINE_B,
    title: `Issue ${String(i + 1)}`,
  }));
  const draft: ReportDraft = {
    version: DRAFT_VERSION,
    entries,
    single: emptySingle(),
  };
  localStorage.setItem(REPORT_DRAFT_KEY, serializeDraft(draft));
}

function renderTabs(canQuick: boolean): void {
  render(
    <ReportDraftProvider machines={machines} assignees={[]}>
      <ReportTabs canQuick={canQuick} />
    </ReportDraftProvider>
  );
}

describe("ReportTabs", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(usePathname).mockReturnValue("/report");
  });
  afterEach(() => localStorage.clear());

  it("marks Single active on /report and links both tabs", () => {
    vi.mocked(usePathname).mockReturnValue("/report");
    renderTabs(true);

    const single = screen.getByRole("link", { name: /single issue/i });
    const multiple = screen.getByRole("link", { name: /multiple/i });

    expect(single).toHaveAttribute("href", "/report");
    expect(multiple).toHaveAttribute("href", "/report/quick");
    expect(single).toHaveAttribute("aria-current", "page");
    expect(multiple).not.toHaveAttribute("aria-current");
  });

  it("marks Multiple active on /report/quick", () => {
    vi.mocked(usePathname).mockReturnValue("/report/quick");
    renderTabs(true);

    expect(screen.getByRole("link", { name: /multiple/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: /single issue/i })
    ).not.toHaveAttribute("aria-current");
  });

  it("renders nothing when the user lacks quick-report permission", () => {
    const { container } = render(
      <ReportDraftProvider machines={machines} assignees={[]}>
        <ReportTabs canQuick={false} />
      </ReportDraftProvider>
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link", { name: /multiple/i })).toBeNull();
  });

  it("leaves Single enabled with a single content row", () => {
    seedContentRows(1);
    renderTabs(true);

    // Still a navigable link, no lock reason shown.
    expect(
      screen.getByRole("link", { name: /single issue/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/remove the extras/i)).not.toBeInTheDocument();
  });

  it("disables Single with 2+ content rows and reveals the reason on tap", async () => {
    seedContentRows(2);
    renderTabs(true);

    // No longer a link — a non-navigating aria-disabled control.
    expect(screen.queryByRole("link", { name: /single issue/i })).toBeNull();
    const single = screen.getByTestId("report-tab-single");
    expect(single).toHaveAttribute("aria-disabled", "true");

    // The reason is hidden until tapped…
    expect(screen.queryByText(/remove the extras/i)).not.toBeInTheDocument();
    await userEvent.click(single);
    expect(
      screen.getByText(
        /you're logging several issues — remove the extras to go back to a single report\./i
      )
    ).toBeInTheDocument();
  });
});
