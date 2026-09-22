import React from "react";
import { renderToString } from "react-dom/server";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportDraftProvider } from "./report-draft-store";
import { QuickReportForm } from "./quick-report-form";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./actions", () => ({
  submitPublicIssueAction: vi.fn(),
  getRecentIssuesAction: vi.fn().mockResolvedValue({ ok: true, value: [] }),
}));

vi.mock("~/components/issues/QuickRecentIssues", () => ({
  QuickRecentIssues: () => <div data-testid="recent-issues" />,
}));

const MACHINE = {
  id: "11111111-1111-4111-8111-111111111111",
  value: "11111111-1111-4111-8111-111111111111",
  name: "Attack from Mars",
  initials: "AFM",
};

function renderForm(canMultiple: boolean): void {
  render(
    <ReportDraftProvider machines={[MACHINE]} assignees={[]}>
      <QuickReportForm
        machinesList={[MACHINE]}
        canMultiple={canMultiple}
        initialIssues={[]}
        initialMachineInitials=""
      />
    </ReportDraftProvider>
  );
}

describe("QuickReportForm", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders URL machine and Quick frequency on the first server paint", () => {
    const markup = renderToString(
      <ReportDraftProvider machines={[MACHINE]} assignees={[]}>
        <QuickReportForm
          machinesList={[MACHINE]}
          defaultMachineId={MACHINE.id}
          canMultiple={false}
          initialIssues={[]}
          initialMachineInitials="AFM"
        />
      </ReportDraftProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = markup;

    expect(container.querySelector("#quick-machine")).toHaveTextContent(
      "Attack from Mars"
    );
    expect(
      container.querySelector('input[name="frequency"]:checked')
    ).toHaveAttribute("value", "not_specified");
  });

  it("starts with the approved Quick fields and Not specified frequency", async () => {
    renderForm(false);

    expect(
      screen.getByRole("combobox", { name: "Machine" })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Problem" })).toHaveAttribute(
      "maxlength",
      "60"
    );
    await waitFor(() => {
      expect(
        screen.getByRole("radio", { name: "Not specified" })
      ).toBeChecked();
    });
    expect(screen.getByRole("link", { name: "Add details" })).toHaveAttribute(
      "href",
      "/report/detailed"
    );
  });

  it("hides Multiple without capability and shows it when permitted", () => {
    const { unmount } = render(
      <ReportDraftProvider machines={[MACHINE]} assignees={[]}>
        <QuickReportForm
          machinesList={[MACHINE]}
          canMultiple={false}
          initialIssues={[]}
          initialMachineInitials=""
        />
      </ReportDraftProvider>
    );
    expect(
      screen.queryByRole("link", { name: "Report multiple issues" })
    ).not.toBeInTheDocument();

    unmount();
    renderForm(true);
    expect(
      screen.getByRole("link", { name: "Report multiple issues" })
    ).toHaveAttribute("href", "/report/multiple");
  });
});
