import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import { MACHINE_STATUS_COLORS } from "~/lib/machines/status";
import type { MachineViewFieldId, MachineViewRow } from "~/lib/types";
import { MachineViewCompactList } from "./MachineViewCompactList";

const DEFAULT_COLUMNS: MachineViewFieldId[] = [
  "machine",
  "playability",
  "presence",
  "openIssues",
  "lastServiced",
  "lastActivity",
];

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

function renderList(
  rows: MachineViewRow[],
  columns: MachineViewFieldId[] = DEFAULT_COLUMNS
): void {
  render(
    <RelativeTimeProvider>
      <MachineViewCompactList rows={rows} columns={columns} />
    </RelativeTimeProvider>
  );
}

/** A row's second line; jsdom has no layout, so it is found by its tag. */
function detailLine(row: HTMLElement): HTMLElement {
  const line = row.querySelector("p");
  if (!line) throw new Error("No detail line");
  return line;
}

/**
 * jsdom lays nothing out, so the detail line gets `lineWidth` and each
 * measured part 6px per character, separator included.
 */
function stubLayout(lineWidth: number): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const width =
        this.tagName === "P"
          ? lineWidth
          : this.hasAttribute("data-measure")
            ? (this.textContent?.length ?? 0) * 6
            : 0;
      return DOMRect.fromRect({ width, height: 16 });
    }
  );
}

describe("MachineViewCompactList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("puts the Playability dot, identity, and open-issue count on line 1", () => {
    renderList([machine()]);

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
    renderList([machine()]);

    const line = detailLine(screen.getByRole("listitem"));
    expect(line).toHaveTextContent(
      /^Unplayable · Stern · 2019 · Alex · serviced 3d$/
    );
    expect(line).toHaveClass("truncate");
    expect(within(line).getByText("Unplayable")).toHaveClass(
      MACHINE_STATUS_COLORS.unplayable.text
    );
    // Only the Playability label is colored; the owner stays muted.
    expect(line).toHaveClass("text-muted-foreground");
    expect(line.querySelectorAll("span")).toHaveLength(1);
  });

  it("makes the whole row a link to the machine, under the count's own link", () => {
    renderList([machine()]);

    expect(
      screen.getByRole("list", { name: "Machines list" })
    ).toBeInTheDocument();
    const row = screen.getByRole("listitem");
    const title = within(row).getByRole("link", {
      name: "Elvira's House of Horrors (Blood Red Kiss Edition)",
    });
    // The title's overlay fills the row, which is its containing block.
    expect(row).toHaveClass("relative");
    expect(title).toHaveClass("after:absolute", "after:inset-0");
    // The count is positioned and later in the row, so it stays on top.
    expect(
      within(row).getByRole("link", { name: /^View 2 open issues/ })
    ).toHaveClass("relative");
  });

  it("leaves the Playability label and service age out when those fields are not displayed", () => {
    renderList([machine({ year: null })], ["machine", "presence"]);

    expect(detailLine(screen.getByRole("listitem"))).toHaveTextContent(
      /^Stern · Unknown · Alex$/
    );
  });

  it("says “never serviced” for a machine without service history", () => {
    renderList([machine({ lastServicedAt: null })]);

    expect(detailLine(screen.getByRole("listitem"))).toHaveTextContent(
      /^Unplayable · Stern · 2019 · Alex · never serviced$/
    );
  });

  it("drops year, then manufacturer, then service age, then owner, keeping the Playability label", () => {
    // Unplayable 60, · Stern 48, · 2019 42, · Alex 42, · never serviced 102:
    // 294 in all.
    const row = machine({ lastServicedAt: null });
    const cases: [number, RegExp][] = [
      [294, /^Unplayable · Stern · 2019 · Alex · never serviced$/],
      [293, /^Unplayable · Stern · Alex · never serviced$/],
      [251, /^Unplayable · Alex · never serviced$/],
      [203, /^Unplayable · Alex$/],
      [40, /^Unplayable$/],
    ];
    for (const [width, expected] of cases) {
      stubLayout(width);
      const { unmount } = render(
        <RelativeTimeProvider>
          <MachineViewCompactList rows={[row]} columns={DEFAULT_COLUMNS} />
        </RelativeTimeProvider>
      );
      expect(detailLine(screen.getByRole("listitem"))).toHaveTextContent(
        expected
      );
      unmount();
      vi.restoreAllMocks();
    }
  });

  it("gives each Playability its own dot shape and name, so color is not the only signal", () => {
    const health = (
      playability: "operational" | "needs_service" | "unplayable"
    ): MachineViewRow["health"] => ({
      openIssues: 0,
      bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 0 },
      worstSeverity: null,
      oldestOpenIssueAt: null,
      playability,
    });
    renderList([
      machine({ id: "a", health: health("operational") }),
      machine({ id: "b", health: health("needs_service") }),
      machine({ id: "c", health: health("unplayable") }),
    ]);

    const dots = ["Operational", "Needs Service", "Unplayable"].map((name) =>
      screen.getByRole("img", { name })
    );
    const shapes = dots.map(
      (dot) => dot.querySelector("span")?.className ?? ""
    );
    expect(new Set(shapes).size).toBe(3);
  });

  it("names the worst open severity in the count's accessible name and tooltip", () => {
    renderList([
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
    renderList([machine()]);

    const count = screen.getByRole("link", { name: /^View 2 open issues/ });
    // At least 44px wide (list-views §7.9), growing leftward from the
    // link's right edge into the gap before it.
    expect(count).toHaveClass(
      "relative",
      "before:absolute",
      "before:right-0",
      "before:w-full",
      "before:min-w-11"
    );
    // It ends at the link's bottom, so line 2 stays the row link.
    expect(count).toHaveClass("before:bottom-0");
    expect(count).not.toContainElement(
      screen.getByRole("link", {
        name: "Elvira's House of Horrors (Blood Red Kiss Edition)",
      })
    );
  });

  it("keeps a machine with no open issues neutral and unlinked", () => {
    renderList([
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
