import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";
import { getMachineViewPreset } from "~/lib/machines/view/config";
import type { MachineViewRow } from "~/lib/types";
import { MachineViewTable } from "./MachineViewTable";

function machine(overrides: Partial<MachineViewRow> = {}): MachineViewRow {
  return {
    id: "machine-1",
    initials: "AFM",
    title: "Attack from Mars",
    manufacturer: "Bally",
    year: 1995,
    ownerName: "Alex",
    presence: "on_the_floor",
    createdAt: "2026-01-01T00:00:00.000Z",
    health: {
      openIssues: 2,
      bySeverity: { cosmetic: 0, minor: 1, major: 1, unplayable: 0 },
      worstSeverity: "major",
      oldestOpenIssueAt: "2026-01-02T00:00:00.000Z",
      playability: "needs_service",
    },
    lastServicedAt: "2026-01-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("MachineViewTable", () => {
  it("renders the approved identity and links issue and service values", () => {
    render(
      <RelativeTimeProvider>
        <MachineViewTable
          rows={[machine()]}
          state={getMachineViewPreset("machines").defaultState}
          mobileMode="compact"
          onSort={vi.fn()}
        />
      </RelativeTimeProvider>
    );

    expect(
      screen.getByRole("link", { name: "Attack from Mars" })
    ).toHaveAttribute("href", "/m/AFM");
    expect(screen.getByText("Bally · 1995 · Alex")).toBeInTheDocument();
    const issueLink = screen.getByRole("link", {
      name: "View 2 open issues for Attack from Mars",
    });
    expect(issueLink).toHaveAttribute("href", "/issues?machine=AFM");
    expect(issueLink).toHaveClass("text-amber-500");
    expect(
      screen.getByRole("link", {
        name: "View service history for Attack from Mars",
      })
    ).toHaveAttribute("href", "/m/AFM/maintenance");
  });

  it("centers issue counts and renders Never without a service link", () => {
    render(
      <MachineViewTable
        rows={[
          machine({
            id: "machine-2",
            initials: "MM",
            title: "Medieval Madness",
            lastServicedAt: null,
          }),
        ]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="compact"
        onSort={vi.fn()}
      />
    );

    const issueCell = screen
      .getByRole("link", { name: /view 2 open issues/i })
      .closest("td");
    expect(issueCell).toHaveClass("text-center");
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /service history/i })
    ).not.toBeInTheDocument();
  });

  it("reports sort state and delegates keyboard-operable sorting", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <MachineViewTable
        rows={[machine()]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="compact"
        onSort={onSort}
      />
    );

    const machineHeader = screen.getByRole("columnheader", {
      name: /machine/i,
    });
    const issueHeader = screen.getByRole("columnheader", {
      name: /open issues/i,
    });
    expect(machineHeader).toHaveAttribute("aria-sort", "ascending");
    expect(issueHeader).toHaveAttribute("aria-sort", "none");
    await user.click(within(issueHeader).getByRole("button"));
    expect(onSort).toHaveBeenCalledWith("openIssues");
  });

  it("uses the selection seam without navigating", async () => {
    const user = userEvent.setup();
    const onMachineSelect = vi.fn();
    render(
      <MachineViewTable
        rows={[machine()]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="compact"
        onSort={vi.fn()}
        onMachineSelect={onMachineSelect}
      />
    );

    await user.click(screen.getByRole("link", { name: "Attack from Mars" }));
    expect(onMachineSelect).toHaveBeenCalledWith("machine-1");
  });

  it("shows a phone overflow cue only in table mode", () => {
    const { rerender } = render(
      <MachineViewTable
        rows={[machine()]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="table"
        onSort={vi.fn()}
      />
    );
    expect(screen.getByText(/scroll for more/i)).toBeInTheDocument();

    rerender(
      <MachineViewTable
        rows={[machine()]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="compact"
        onSort={vi.fn()}
      />
    );
    expect(screen.queryByText(/scroll for more/i)).not.toBeInTheDocument();
  });
});
