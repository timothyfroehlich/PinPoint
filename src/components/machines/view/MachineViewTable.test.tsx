import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
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
    hasOwner: true,
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
  it("shows identity on two lines and Owner, Manufacturer, and Year as fields of their own", () => {
    const defaults = getMachineViewPreset("machines").defaultState;
    render(
      <RelativeTimeProvider>
        <MachineViewTable
          rows={[machine()]}
          state={{
            ...defaults,
            columns: [...defaults.columns, "owner", "manufacturer", "year"],
          }}
          mobileMode="compact"
          onSort={vi.fn()}
        />
      </RelativeTimeProvider>
    );

    const identity = screen.getByRole("rowheader");
    const titleLink = within(identity).getByRole("link", {
      name: "Attack from Mars",
    });
    expect(titleLink).toHaveAttribute("href", "/m/AFM");
    expect(titleLink).toHaveAttribute("title", "Attack from Mars");
    expect(within(identity).getByText("AFM")).toBeInTheDocument();
    const details = within(identity).getByTitle("Bally · 1995 · Alex");
    expect(details).toHaveTextContent(/^Bally · 1995 · Alex$/);
    expect(details).toHaveClass("truncate", "text-muted-foreground");
    expect(within(details).getByText("Alex")).toHaveClass("text-foreground");

    const cells = screen.getAllByRole("cell");
    const headers = screen
      .getAllByRole("columnheader")
      .slice(1)
      .map((header) => header.textContent);
    const valueFor = (label: string): string | null =>
      cells[headers.indexOf(label)]?.textContent ?? null;
    expect(valueFor("Owner")).toBe("Alex");
    expect(valueFor("Manufacturer")).toBe("Bally");
    expect(valueFor("Year")).toBe("1995");
    expect(
      screen.getByRole("link", {
        name: "View service history for Attack from Mars",
      })
    ).toHaveAttribute("href", "/m/AFM/maintenance");
  });

  it("names missing identity details Unknown and Unassigned, keeping Unassigned muted", () => {
    render(
      <MachineViewTable
        rows={[
          machine({
            manufacturer: "Unknown",
            year: null,
            ownerName: "Unassigned",
            hasOwner: false,
          }),
        ]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="compact"
        onSort={vi.fn()}
      />
    );

    const details = within(screen.getByRole("rowheader")).getByTitle(
      "Unknown · Unknown · Unassigned"
    );
    expect(within(details).getByText("Unassigned")).not.toHaveClass(
      "text-foreground"
    );
  });

  it("right-aligns a severity-colored issue count linking to the machine's issues in every presence state", () => {
    render(
      <MachineViewTable
        rows={[machine()]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="compact"
        onSort={vi.fn()}
      />
    );

    const issueLink = screen.getByRole("link", {
      name: "View 2 open issues for Attack from Mars, worst Major",
    });
    expect(issueLink).toHaveTextContent(/^2$/);
    expect(issueLink).toHaveAttribute("title", "Worst severity: Major");
    // The phone hit area belongs to the Compact row only.
    expect(issueLink).not.toHaveClass("before:-inset-y-3.5");
    const href = new URL(
      issueLink.getAttribute("href") ?? "",
      "https://pinpoint.test"
    );
    expect(href.pathname).toBe("/issues");
    expect(href.searchParams.get("machine")).toBe("AFM");
    expect(href.searchParams.get("presence")).toBe("all");
    expect(issueLink).toHaveClass(SEVERITY_CONFIG.major.iconColor);
    expect(issueLink.closest("td")).toHaveClass("text-right");
    expect(
      screen.getByRole("columnheader", { name: /open issues/i })
    ).toHaveClass("text-right");
  });

  it("keeps a zero issue count neutral and unlinked, and renders Never without a service link", () => {
    render(
      <MachineViewTable
        rows={[
          machine({
            id: "machine-2",
            initials: "MM",
            title: "Medieval Madness",
            lastServicedAt: null,
            health: {
              openIssues: 0,
              bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 0 },
              worstSeverity: null,
              oldestOpenIssueAt: null,
              playability: "operational",
            },
          }),
        ]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="compact"
        onSort={vi.fn()}
      />
    );

    expect(
      screen.queryByRole("link", { name: /open issue/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText("0")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /service history/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the pinned Machine cell opaque on hover so scrolled cells never show through", () => {
    render(
      <MachineViewTable
        rows={[machine()]}
        state={getMachineViewPreset("machines").defaultState}
        mobileMode="table"
        onSort={vi.fn()}
      />
    );

    const pinned = screen.getByRole("rowheader");
    expect(pinned).toHaveClass("sticky", "bg-card");
    // The hover tint is a translucent image layered over the opaque card
    // color, never a translucent background color.
    expect(pinned).toHaveClass(
      "group-hover:bg-linear-to-r",
      "group-hover:from-muted/50",
      "group-hover:to-muted/50"
    );
    expect(pinned).not.toHaveClass("group-hover:bg-muted/50");
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
