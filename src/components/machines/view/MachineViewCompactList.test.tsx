import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import type { MachineViewRow } from "~/lib/types";
import { MachineViewCompactList } from "./MachineViewCompactList";

function machine(overrides: Partial<MachineViewRow> = {}): MachineViewRow {
  return {
    id: "machine-1",
    initials: "EHOH",
    title: "Elvira's House of Horrors (Blood Red Kiss Edition)",
    manufacturer: "Stern",
    year: 2019,
    ownerName: "Alex",
    hasOwner: true,
    presence: "on_the_floor",
    createdAt: "2026-01-01T00:00:00.000Z",
    health: {
      openIssues: 2,
      bySeverity: { cosmetic: 0, minor: 1, major: 0, unplayable: 1 },
      worstSeverity: "unplayable",
      oldestOpenIssueAt: "2026-01-02T00:00:00.000Z",
      playability: "unplayable",
    },
    lastServicedAt: "2026-01-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("MachineViewCompactList", () => {
  it("shows one line of Playability, identity, and open-issue count, and no other fields", () => {
    render(<MachineViewCompactList rows={[machine()]} />);

    const row = screen.getByRole("listitem");
    expect(
      within(row).getByRole("img", { name: "Unplayable" })
    ).toBeInTheDocument();
    const title = within(row).getByRole("link", {
      name: "Elvira's House of Horrors (Blood Red Kiss Edition)",
    });
    expect(title).toHaveAttribute("href", "/m/EHOH");
    expect(title).toHaveAttribute(
      "title",
      "Elvira's House of Horrors (Blood Red Kiss Edition)"
    );
    expect(within(row).getByText("EHOH")).toBeInTheDocument();

    const count = within(row).getByRole("link", {
      name: "View 2 open issues for Elvira's House of Horrors (Blood Red Kiss Edition), worst Unplayable",
    });
    expect(count).toHaveTextContent(/^2 open$/);
    expect(count).toHaveClass(SEVERITY_CONFIG.unplayable.iconColor);
    expect(count.getAttribute("href")).toBe(
      "/issues?machine=EHOH&include_inactive_machines=true"
    );

    // Owner, Manufacturer, Year, and service age appear only in Table mode.
    expect(row).not.toHaveTextContent("Alex");
    expect(row).not.toHaveTextContent("Stern");
    expect(row).not.toHaveTextContent("2019");
    expect(within(row).queryAllByRole("link")).toHaveLength(2);
  });

  it("names each Playability state so color is not the only signal", () => {
    render(
      <MachineViewCompactList
        rows={[
          machine({
            id: "machine-2",
            initials: "TZ",
            title: "Twilight Zone",
            health: {
              openIssues: 0,
              bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 0 },
              worstSeverity: null,
              oldestOpenIssueAt: null,
              playability: "operational",
            },
          }),
          machine({
            id: "machine-3",
            initials: "MM",
            title: "Medieval Madness",
            health: {
              openIssues: 1,
              bySeverity: { cosmetic: 0, minor: 0, major: 1, unplayable: 0 },
              worstSeverity: "major",
              oldestOpenIssueAt: null,
              playability: "needs_service",
            },
          }),
        ]}
      />
    );

    const [operational, needsService] = screen.getAllByRole("listitem");
    expect(
      within(operational ?? document.body).getByRole("img", {
        name: "Operational",
      })
    ).toBeInTheDocument();
    expect(
      within(needsService ?? document.body).getByRole("img", {
        name: "Needs Service",
      })
    ).toBeInTheDocument();
  });

  it("names the worst open severity, since every severity shares one icon", () => {
    render(
      <MachineViewCompactList
        rows={[
          machine({
            id: "machine-3",
            initials: "MM",
            title: "Medieval Madness",
            health: {
              openIssues: 1,
              bySeverity: { cosmetic: 0, minor: 0, major: 1, unplayable: 0 },
              worstSeverity: "major",
              oldestOpenIssueAt: null,
              playability: "needs_service",
            },
          }),
        ]}
      />
    );

    const count = screen.getByRole("link", {
      name: "View 1 open issue for Medieval Madness, worst Major",
    });
    // Sighted users get the severity as a tooltip; the text stays compact.
    expect(count).toHaveAttribute("title", "Worst severity: Major");
    expect(count).toHaveTextContent(/^1 open$/);
  });

  it("gives the count a 44px-tall hit area that stays clear of the title", () => {
    render(<MachineViewCompactList rows={[machine()]} />);

    const count = screen.getByRole("link", { name: /^View 2 open issues/ });
    // A 16px link plus 14px above and below is 44px (list-views §7.9).
    expect(count).toHaveClass(
      "relative",
      "before:absolute",
      "before:-inset-y-3.5"
    );
    // The hit area keeps the link's width, so it never reaches the title.
    expect(count).toHaveClass("before:inset-x-0");
    expect(count).not.toContainElement(
      screen.getByRole("link", {
        name: "Elvira's House of Horrors (Blood Red Kiss Edition)",
      })
    );
  });

  it("keeps a machine with no open issues neutral and unlinked", () => {
    render(
      <MachineViewCompactList
        rows={[
          machine({
            health: {
              openIssues: 0,
              bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 0 },
              worstSeverity: null,
              oldestOpenIssueAt: null,
              playability: "operational",
            },
          }),
        ]}
      />
    );

    expect(screen.getByText("None open")).toHaveClass("text-muted-foreground");
    expect(
      screen.queryByRole("link", { name: /open issue/i })
    ).not.toBeInTheDocument();
  });
});
