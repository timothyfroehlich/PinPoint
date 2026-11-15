/**
 * RTL tests for the machine rows (machine-views §5.3, §5.9, §5.10): what each
 * row shows, the whole-row link, and line 2 dropping parts in order when it
 * does not fit.
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import { MACHINE_STATUS_COLORS } from "~/lib/machines/status";
import type { MachineViewRow } from "~/lib/types";
import { MachineViewRows } from "./MachineViewRows";

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

function renderRows(rows: MachineViewRow[]): ReturnType<typeof render> {
  return render(
    <RelativeTimeProvider>
      <MachineViewRows rows={rows} />
    </RelativeTimeProvider>
  );
}

/** A row's second line. */
function detailLine(row: HTMLElement): HTMLElement {
  return within(row).getByTestId("machine-row-detail");
}

/** Line 2's two groups: Playability, manufacturer, year, owner; the age. */
function groups(row: HTMLElement): [Element, Element] {
  const [leading, trailing] = Array.from(detailLine(row).children);
  if (!leading || !trailing) throw new Error("Expected two groups");
  return [leading, trailing];
}

/**
 * A group's parts as shown, sr-only parts left out and each avatar's
 * initials in brackets: "Unplayable · Stern · 2019 [A]".
 */
function shownParts(group: Element): string {
  return Array.from(group.children)
    .filter((part) => !part.classList.contains("sr-only"))
    .map((part) => {
      const copy = part.cloneNode(true);
      if (!(copy instanceof HTMLElement)) return "";
      for (const hidden of copy.querySelectorAll(".sr-only")) hidden.remove();
      for (const avatar of copy.querySelectorAll('[role="img"]')) {
        avatar.textContent = `[${avatar.textContent ?? ""}]`;
      }
      return copy.textContent ?? "";
    })
    .join(" ");
}

/** What line 2 shows, as "leading group | trailing group". */
function lineSummary(row: HTMLElement): string {
  const [leading, trailing] = groups(row);
  return `${shownParts(leading)} | ${shownParts(trailing) || "-"}`;
}

/**
 * jsdom lays nothing out, so line 2 gets `lineWidth` and each measured part
 * its width from `widths`.
 */
function stubLayout(
  lineWidth: number,
  widths: Readonly<Record<string, number>>
): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const key = this.getAttribute("data-measure");
      const width = this.hasAttribute("data-row-line")
        ? lineWidth
        : key === null
          ? 0
          : (widths[key] ?? 0);
      return DOMRect.fromRect({ width, height: 20 });
    }
  );
}

describe("Machine rows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("puts the Playability dot, identity, and open-issue count on line 1", () => {
    renderRows([machine()]);

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
    expect(title).toHaveClass("truncate");
    expect(within(row).getByText("EHOH")).toBeInTheDocument();

    const count = within(row).getByRole("link", {
      name: "View 2 open issues for Elvira's House of Horrors (Blood Red Kiss Edition), worst Unplayable",
    });
    // Colored text alone, with no severity icon before it (§5.3).
    expect(count).toHaveTextContent(/^2 open$/);
    expect(count).toHaveClass(SEVERITY_CONFIG.unplayable.iconColor);
    expect(count.querySelector("svg")).toBeNull();
    expect(count.getAttribute("href")).toBe(
      "/issues?machine=EHOH&presence=all"
    );
    expect(within(row).queryAllByRole("link")).toHaveLength(2);
  });

  it("shows the Playability label, manufacturer, year, owner, and service age on line 2", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-06T00:00:00.000Z"));
    renderRows([machine()]);

    const row = screen.getByRole("listitem");
    const line = detailLine(row);
    const [leading, trailing] = groups(row);
    // "·" only between text parts; none before the avatar.
    expect(lineSummary(row)).toBe("Unplayable · Stern · 2019 [A] | 3d ago");
    expect(within(line).getByText("Unplayable")).toHaveClass(
      MACHINE_STATUS_COLORS.unplayable.text
    );
    expect(line).toHaveClass("text-muted-foreground", "text-[13px]");

    // The owner is the same initials avatar as the issue row's assignee.
    const owner = within(leading as HTMLElement).getByRole("img", {
      name: "Owner: Alex",
    });
    expect(owner).toHaveTextContent(/^A$/);
    expect(owner).toHaveClass("size-5", "text-[9px]", "bg-outline");

    // The service age is right-anchored, a wrench and a short age.
    expect(trailing).toHaveClass("ml-auto", "shrink-0", "pl-3");
    const age = within(line).getByTestId("machine-row-service-age");
    expect(trailing).toContainElement(age);
    expect(within(age).getByText("3d ago")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(within(age).getByText("Serviced 3 days ago")).toHaveClass("sr-only");
    expect(age.querySelector("svg.lucide-wrench")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    // Plain text: the row still has only its title and count links.
    expect(within(row).queryAllByRole("link")).toHaveLength(2);
  });

  it("reads hour-old service in hours", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-03T02:30:00.000Z"));
    renderRows([machine()]);

    const age = within(screen.getByRole("listitem")).getByTestId(
      "machine-row-service-age"
    );
    expect(within(age).getByText("2h ago")).toBeInTheDocument();
    expect(within(age).getByText("Serviced 2 hours ago")).toBeInTheDocument();
  });

  it("shows “Unknown” for a machine with no year", () => {
    renderRows([machine({ year: null })]);
    expect(lineSummary(screen.getByRole("listitem"))).toMatch(
      /^Unplayable · Stern · Unknown \[A\] \| /
    );
  });

  it("shows an empty dashed avatar for a machine with no owner", () => {
    renderRows([machine({ ownerName: "Unassigned", hasOwner: false })]);

    const owner = within(screen.getByRole("listitem")).getByRole("img", {
      name: "No owner",
    });
    expect(owner).toBeEmptyDOMElement();
    expect(owner).toHaveClass("border-dashed");
    expect(owner).not.toHaveClass("bg-outline");
  });

  it("makes the whole row a link to the machine, under the count's own link", () => {
    renderRows([machine()]);

    expect(
      screen.getByRole("list", { name: "Machines list" })
    ).toBeInTheDocument();
    const row = screen.getByRole("listitem");
    const title = within(row).getByRole("link", {
      name: "Elvira's House of Horrors (Blood Red Kiss Edition)",
    });
    // The title's overlay fills the row, which is its containing block.
    expect(row).toHaveClass("relative", "isolate");
    expect(title).toHaveClass("after:absolute", "after:inset-0");
    // The count is raised above the overlay.
    expect(
      within(row).getByRole("link", { name: /^View 2 open issues/ })
    ).toHaveClass("relative", "z-[2]");
  });

  it("raises the Playability dot and owner avatar above the row link, so their tooltips show", () => {
    renderRows([machine()]);
    const row = within(screen.getByRole("listitem"));

    const dot = row.getByRole("img", { name: "Unplayable" });
    expect(dot).toHaveAttribute("title", "Unplayable");
    expect(dot).toHaveClass("relative", "z-[2]");
    const owner = row.getByRole("img", { name: "Owner: Alex" });
    expect(owner).toHaveAttribute("title", "Owner: Alex");
    expect(owner).toHaveClass("relative", "z-[2]");
  });

  it("calls the selection handler instead of navigating when a Surface picks machines", () => {
    const onMachineSelect = vi.fn();
    render(
      <RelativeTimeProvider>
        <MachineViewRows rows={[machine()]} onMachineSelect={onMachineSelect} />
      </RelativeTimeProvider>
    );

    screen
      .getByRole("link", {
        name: "Elvira's House of Horrors (Blood Red Kiss Edition)",
      })
      .click();
    expect(onMachineSelect).toHaveBeenCalledWith("machine-1");
  });

  it("puts a row action at the row's end, above the row link", () => {
    render(
      <RelativeTimeProvider>
        <MachineViewRows
          rows={[machine()]}
          rowAction={(row) => <button type="button">Add {row.title}</button>}
        />
      </RelativeTimeProvider>
    );

    const action = screen.getByRole("button", { name: /^Add Elvira/ });
    expect(action.parentElement).toHaveClass("relative", "z-[2]");
  });

  it("shows the added age in place of the service age while sorted by Date Added (§5.15)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-04T00:00:00.000Z"));
    render(
      <RelativeTimeProvider>
        <MachineViewRows rows={[machine()]} age="added" />
      </RelativeTimeProvider>
    );

    const row = screen.getByRole("listitem");
    expect(lineSummary(row)).toBe(
      "Unplayable · Stern · 2019 [A] | added 3d ago"
    );
    expect(
      within(row).queryByTestId("machine-row-service-age")
    ).not.toBeInTheDocument();
    const age = within(row).getByTestId("machine-row-added-age");
    expect(age).toHaveAttribute("datetime", "2026-01-01T00:00:00.000Z");
    // No wrench: the added age is words alone.
    expect(age.querySelector("svg")).toBeNull();
    expect(within(age).getByText("Added 3 days ago")).toHaveClass("sr-only");
  });

  it("says “never” for a machine without service history", () => {
    renderRows([machine({ lastServicedAt: null })]);

    const age = within(screen.getByRole("listitem")).getByTestId(
      "machine-row-service-age"
    );
    expect(within(age).getByText("never")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(within(age).getByText("Never serviced")).toHaveClass("sr-only");
  });

  it("drops year, then manufacturer, then service age, then owner, keeping the Playability label", () => {
    // Unplayable 60, · Stern 48, · 2019 42 and the avatar 26, with 6px gaps
    // and a 4px "·": 214. Then 12px and the service age 60: 286 in all.
    const widths = {
      "·": 4,
      playability: 60,
      manufacturer: 48,
      year: 42,
      owner: 26,
      age: 60,
    };
    const row = machine({ lastServicedAt: null });
    // Each width is the parts' total plus the 16px fit tolerance.
    const cases: [number, string][] = [
      [302, "Unplayable · Stern · 2019 [A] | never"],
      [301, "Unplayable · Stern [A] | never"],
      [243, "Unplayable [A] | never"],
      // Without the service age the leading group has the whole line.
      [179, "Unplayable [A] | -"],
      [107, "Unplayable | -"],
      [40, "Unplayable | -"],
    ];
    for (const [width, expected] of cases) {
      stubLayout(width, widths);
      const { unmount } = renderRows([row]);
      expect(lineSummary(screen.getByRole("listitem"))).toBe(expected);
      unmount();
      vi.restoreAllMocks();
    }
  });

  it("keeps dropped parts readable to screen readers", () => {
    stubLayout(40, {
      playability: 60,
      manufacturer: 48,
      year: 42,
      owner: 26,
      age: 60,
    });
    renderRows([machine({ lastServicedAt: null })]);

    const row = screen.getByRole("listitem");
    const line = detailLine(row);
    expect(lineSummary(row)).toBe("Unplayable | -");
    // Hidden visually, still in the accessibility tree.
    expect(within(line).getByText("Stern")).toHaveClass("sr-only");
    expect(within(line).getByText("2019")).toHaveClass("sr-only");
    expect(
      within(line).getByRole("img", { name: "Owner: Alex" }).parentElement
    ).toHaveClass("sr-only");
    expect(
      within(line).getByTestId("machine-row-service-age").parentElement
    ).toHaveClass("sr-only");
    expect(within(line).getByText("Never serviced")).toBeInTheDocument();
  });

  it("shows a two- or three-capital owner name whole in the avatar", () => {
    renderRows([
      machine({ id: "a", ownerName: "APC" }),
      machine({ id: "b", ownerName: "TJ" }),
      machine({ id: "c", ownerName: "Priya Shah" }),
      machine({ id: "d", ownerName: "Apc" }),
      machine({ id: "e", ownerName: "ABCD" }),
    ]);

    const initials = (name: string): string | null =>
      screen.getByRole("img", { name: `Owner: ${name}` }).textContent;
    expect(initials("APC")).toBe("APC");
    expect(initials("TJ")).toBe("TJ");
    expect(initials("Priya Shah")).toBe("PS");
    expect(initials("Apc")).toBe("A");
    expect(initials("ABCD")).toBe("A");
  });

  it.each<[MachineViewRow["health"]["playability"], string, string]>([
    ["operational", "Operational", "bg-current"],
    ["needs_service", "Needs Service", "border-2"],
    ["unplayable", "Unplayable", "rotate-45"],
  ])(
    "draws a %s dot by its own shape, so color is not the only signal",
    (playability, name, shape) => {
      renderRows([
        machine({
          health: {
            openIssues: 0,
            bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 0 },
            worstSeverity: null,
            oldestOpenIssueAt: null,
            playability,
          },
        }),
      ]);

      const dot = screen.getByRole("img", { name });
      expect(dot).toHaveClass(MACHINE_STATUS_COLORS[playability].text);
      expect(dot.firstElementChild).toHaveClass(shape);
    }
  );

  it("names the worst open severity in the count's accessible name and tooltip", () => {
    renderRows([
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
    ]);

    const count = screen.getByRole("link", {
      name: "View 1 open issue for Medieval Madness, worst Major",
    });
    expect(count).toHaveAttribute("title", "Worst severity: Major");
    expect(count).toHaveTextContent(/^1 open$/);
  });

  it("gives the count a 44px-wide hit area that stays clear of the title and line 2", () => {
    renderRows([machine()]);

    const count = screen.getByRole("link", { name: /^View 2 open issues/ });
    // At least 44px wide (list-views §7.9), growing leftward from the
    // link's right edge into the gap before it.
    expect(count).toHaveClass(
      "before:absolute",
      "before:right-0",
      "before:w-full",
      "before:min-w-11"
    );
    // It reaches up through the row's 10px top padding and no further, so it
    // never overlaps the row above; its box starts at line 1's top.
    expect(count).toHaveClass("before:-top-2.5");
    expect(screen.getByRole("listitem")).toHaveClass("py-2.5");
    expect(count.parentElement).toHaveClass("flex");
    // It ends at the link's bottom, so line 2 stays the row link.
    expect(count).toHaveClass("before:bottom-0");
    expect(count).not.toContainElement(
      screen.getByRole("link", {
        name: "Elvira's House of Horrors (Blood Red Kiss Edition)",
      })
    );
  });

  it("keeps a machine with no open issues neutral and unlinked", () => {
    renderRows([
      machine({
        health: {
          openIssues: 0,
          bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 0 },
          worstSeverity: null,
          oldestOpenIssueAt: null,
          playability: "operational",
        },
      }),
    ]);

    expect(screen.getByText("None open")).toHaveClass("text-muted-foreground");
    expect(
      screen.queryByRole("link", { name: /open issue/i })
    ).not.toBeInTheDocument();
  });
});
