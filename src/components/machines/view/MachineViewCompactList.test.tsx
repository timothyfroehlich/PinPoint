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

/** A row's second line. */
function detailLine(row: HTMLElement): HTMLElement {
  return within(row).getByTestId("machine-row-detail");
}

/** Line 2's left group: Playability label, manufacturer, year, owner. */
function leftGroup(row: HTMLElement): HTMLElement {
  const group = detailLine(row).querySelector("p");
  if (!group) throw new Error("No left group");
  return group;
}

/** An element's text without the parts hidden visually (`sr-only`). */
function shownText(element: HTMLElement): string {
  const copy = element.cloneNode(true);
  if (!(copy instanceof HTMLElement)) return "";
  for (const hidden of copy.querySelectorAll(".sr-only")) hidden.remove();
  return copy.textContent ?? "";
}

/** What line 2 shows, as "left group | short service age". */
function lineSummary(row: HTMLElement): string {
  const service = within(detailLine(row)).queryByTestId(
    "machine-row-service-age"
  );
  const age =
    service === null || service.classList.contains("sr-only")
      ? "-"
      : shownText(service);
  return `${shownText(leftGroup(row))} | ${age}`;
}

/**
 * jsdom lays nothing out, so the detail line gets `lineWidth` and each
 * measured part its width from `widths`.
 */
function stubLayout(
  lineWidth: number,
  widths: Readonly<Record<string, number>>
): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const key = this.getAttribute("data-measure");
      const width =
        this.getAttribute("data-testid") === "machine-row-detail"
          ? lineWidth
          : key === null
            ? 0
            : (widths[key] ?? 0);
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

    const row = screen.getByRole("listitem");
    const line = detailLine(row);
    const left = leftGroup(row);
    expect(left).toHaveTextContent(/^Unplayable · Stern · 2019 · A$/);
    expect(left).toHaveClass("truncate");
    expect(within(left).getByText("Unplayable")).toHaveClass(
      MACHINE_STATUS_COLORS.unplayable.text
    );
    expect(line).toHaveClass("text-muted-foreground", "text-[13px]");

    // The owner is an initials avatar, filled like the issue row's assignee.
    const owner = within(left).getByRole("img", { name: "Owner: Alex" });
    expect(owner).toHaveTextContent(/^A$/);
    expect(owner).toHaveClass("size-5", "text-[9px]", "bg-outline");

    // The service age sits after the left group, a wrench and a short age.
    const age = within(line).getByText("3d ago");
    expect(age).toHaveAttribute("aria-hidden", "true");
    expect(left).not.toContainElement(age);
    expect(within(line).getByText("Serviced 3 days ago")).toHaveClass(
      "sr-only"
    );
    const service = age.parentElement;
    expect(service).toHaveClass("ml-auto", "shrink-0");
    expect(service?.querySelector("svg.lucide-wrench")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    // At least 12px from the left group.
    expect(line).toHaveClass("gap-3");
    // Plain text: the row still has only its title and count links.
    expect(within(row).queryAllByRole("link")).toHaveLength(2);
  });

  it("reads hour-old service in hours", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-03T02:30:00.000Z"));
    renderList([machine()]);

    const line = detailLine(screen.getByRole("listitem"));
    expect(within(line).getByText("2h ago")).toBeInTheDocument();
    expect(within(line).getByText("Serviced 2 hours ago")).toBeInTheDocument();
  });

  it("shows an empty dashed avatar for a machine with no owner", () => {
    renderList([machine({ ownerName: "Unassigned", hasOwner: false })]);

    const owner = within(leftGroup(screen.getByRole("listitem"))).getByRole(
      "img",
      { name: "No owner" }
    );
    expect(owner).toBeEmptyDOMElement();
    expect(owner).toHaveClass("border-dashed");
    expect(owner).not.toHaveClass("bg-outline");
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

    expect(lineSummary(screen.getByRole("listitem"))).toBe(
      "Stern · Unknown · A | -"
    );
  });

  it("says “never” for a machine without service history", () => {
    renderList([machine({ lastServicedAt: null })]);

    const line = detailLine(screen.getByRole("listitem"));
    expect(within(line).getByText("never")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(within(line).getByText("Never serviced")).toHaveClass("sr-only");
  });

  it("drops year, then manufacturer, then service age, then owner, keeping the Playability label", () => {
    // Unplayable 60, · Stern 48, · 2019 42, · avatar 32, gap and service
    // age 60: 242 in all.
    const widths = {
      playability: 60,
      manufacturer: 48,
      year: 42,
      owner: 32,
      lastServiced: 60,
    };
    const row = machine({ lastServicedAt: null });
    const cases: [number, string][] = [
      [242, "Unplayable · Stern · 2019 · A | never"],
      [241, "Unplayable · Stern · A | never"],
      [199, "Unplayable · A | never"],
      // Without the service age the left group has the whole line.
      [151, "Unplayable · A | -"],
      [91, "Unplayable | -"],
      [40, "Unplayable | -"],
    ];
    for (const [width, expected] of cases) {
      stubLayout(width, widths);
      const { unmount } = render(
        <RelativeTimeProvider>
          <MachineViewCompactList rows={[row]} columns={DEFAULT_COLUMNS} />
        </RelativeTimeProvider>
      );
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
      owner: 32,
      lastServiced: 60,
    });
    renderList([machine({ lastServicedAt: null })]);

    const row = screen.getByRole("listitem");
    const line = detailLine(row);
    expect(lineSummary(row)).toBe("Unplayable | -");
    // Hidden visually, still in the accessibility tree.
    expect(within(line).getByText("Stern", { exact: false })).toHaveClass(
      "sr-only"
    );
    expect(within(line).getByText("2019", { exact: false })).toHaveClass(
      "sr-only"
    );
    expect(
      within(line).getByRole("img", { name: "Owner: Alex" }).parentElement
    ).toHaveClass("sr-only");
    expect(within(line).getByTestId("machine-row-service-age")).toHaveClass(
      "sr-only"
    );
    expect(within(line).getByText("Never serviced")).toBeInTheDocument();
  });

  it("shows a two- or three-capital owner name whole in the avatar", () => {
    renderList([
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
