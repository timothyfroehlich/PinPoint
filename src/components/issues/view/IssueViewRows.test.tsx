/**
 * RTL tests for the issue rows (issues-list §3): what each row shows, that
 * rows are read-only, the whole-row link, and line 2 dropping parts in order
 * when it does not fit.
 */

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";
import { IssueViewRows } from "./IssueViewRows";
import type { IssueListRow } from "~/lib/types";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const NOW = new Date("2026-01-04T00:00:00.000Z");
const ASSIGNEE_ID = "22222222-2222-4222-8222-222222222222";

function makeIssue(overrides: Partial<IssueListRow> = {}): IssueListRow {
  return {
    id: "issue-1",
    issueNumber: 12,
    title: "Left flipper weak after the second multiball",
    status: "in_progress",
    severity: "major",
    priority: "high",
    frequency: "intermittent",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    machineInitials: "AFM",
    reporterName: null,
    assignedTo: null,
    machine: { id: "machine-1", name: "Attack from Mars" },
    assignedToUser: null,
    commentCount: 0,
    ...overrides,
  };
}

function renderRows(issues: IssueListRow[]): ReturnType<typeof render> {
  return render(
    <RelativeTimeProvider>
      <IssueViewRows rows={issues} />
    </RelativeTimeProvider>
  );
}

/** Line 2's two groups: the left (ID · machine, priority) and the right. */
function line2Groups(row: HTMLElement): Element[] {
  const line = within(row).getByTestId("issue-machine").closest("div");
  if (!line) throw new Error("expected line 2");
  return Array.from(line.children);
}

/**
 * A group's parts as shown, by test ID: screen-reader-only parts left out,
 * and "·" separators shown as "·".
 */
function groupParts(group: Element): string[] {
  return Array.from(group.children)
    .filter((part) => !part.classList.contains("sr-only"))
    .map((part) => {
      const testId =
        part.getAttribute("data-testid") ??
        part.querySelector("[data-testid]")?.getAttribute("data-testid");
      return testId ?? part.textContent;
    });
}

/** Line 2's parts as shown, both groups in order, separators left out. */
function line2Parts(row: HTMLElement): string[] {
  return line2Groups(row)
    .flatMap(groupParts)
    .filter((part) => part !== "·");
}

describe("Issue rows", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the status dot, the title, and the status and severity pills on line 1", () => {
    renderRows([makeIssue()]);
    const row = within(screen.getByRole("listitem"));

    expect(
      row.getByRole("link", {
        name: "Left flipper weak after the second multiball",
      })
    ).toHaveAttribute("href", "/m/AFM/i/12");
    // The dot announces the status; the pill shows it without repeating it.
    expect(row.getByRole("img", { name: "Status: In Progress" })).toBe(
      row.getByTestId("issue-status-dot")
    );
    const statusPill = row.getByTestId("issue-status");
    expect(statusPill).toHaveTextContent(/^In Progress$/);
    expect(statusPill).toHaveAttribute("aria-hidden", "true");
    expect(row.getByTestId("issue-severity")).toHaveTextContent(
      "Severity: Major"
    );
  });

  it.each<[IssueListRow["status"], string]>([
    ["new", "border-2"],
    ["confirmed", "border-2"],
    ["in_progress", "bg-current"],
    ["wait_owner", "bg-current"],
    ["fixed", "rotate-45"],
    ["duplicate", "rotate-45"],
  ])("draws a %s status dot by its group's shape (%s)", (status, shape) => {
    renderRows([makeIssue({ status })]);
    const dot = within(screen.getByRole("listitem")).getByTestId(
      "issue-status-dot"
    );
    expect(dot.firstElementChild).toHaveClass(shape);
  });

  it("shows the ID, machine, priority, assignee, comment count, and age on line 2", () => {
    renderRows([makeIssue({ commentCount: 3 })]);
    const listItem = screen.getByRole("listitem");
    const row = within(listItem);

    expect(line2Parts(listItem)).toEqual([
      "issue-id",
      "issue-machine",
      "issue-priority",
      "issue-assignee",
      "issue-comment-count",
      "issue-age",
    ]);
    expect(row.getByTestId("issue-id")).toHaveTextContent("AFM-12");
    expect(row.getByRole("link", { name: "Attack from Mars" })).toHaveAttribute(
      "href",
      "/m/AFM"
    );
    expect(row.getByTestId("issue-priority")).toHaveTextContent(
      "Priority: High"
    );
    // The number shows; screen readers hear "3 comments".
    expect(row.getByTestId("issue-comment-count")).toHaveTextContent(
      "33 comments"
    );
    // "2d ago" at every width; screen readers hear the spelled-out form.
    const age = row.getByTestId("issue-age");
    expect(age).toHaveAttribute("datetime", "2026-01-02T00:00:00.000Z");
    expect(age).toHaveTextContent(/^2d agoUpdated 2 days ago$/);
  });

  it("groups line 2: ID · machine and the priority left, the rest right-anchored", () => {
    renderRows([makeIssue({ commentCount: 3 })]);
    const groups = line2Groups(screen.getByRole("listitem"));
    const [left, right] = groups;
    if (!left || !right) throw new Error("expected 2 groups");

    expect(groups).toHaveLength(2);
    // A "·" separates only two plain-text items: the ID and the machine. No
    // pill, avatar, or icon item has one beside it.
    expect(groupParts(left)).toEqual([
      "issue-id",
      "·",
      "issue-machine",
      "issue-priority",
    ]);
    expect(groupParts(right)).toEqual([
      "issue-assignee",
      "issue-comment-count",
      "issue-age",
    ]);
    expect(right.textContent).not.toContain("·");
  });

  it("shows the comment count only when there are comments", () => {
    renderRows([
      makeIssue({ id: "a", commentCount: 0 }),
      makeIssue({ id: "b", issueNumber: 13, commentCount: 1 }),
    ]);
    const [withoutComments, withComment] = screen.getAllByRole("listitem");
    if (!withoutComments || !withComment) throw new Error("expected 2 rows");

    expect(
      within(withoutComments).queryByTestId("issue-comment-count")
    ).toBeNull();
    expect(
      within(withComment).getByTestId("issue-comment-count")
    ).toHaveTextContent(/^11 comment$/);
  });

  it("is read-only: no buttons", () => {
    renderRows([makeIssue({ commentCount: 2 })]);
    const row = within(screen.getByRole("listitem"));

    expect(row.queryByRole("button")).toBeNull();
    // Two links: the issue (the whole row) and the machine.
    expect(row.getAllByRole("link")).toHaveLength(2);
  });

  it("raises the status dot and assignee avatar above the row link, so their tooltips show", () => {
    renderRows([makeIssue()]);
    const row = within(screen.getByRole("listitem"));

    const dot = row.getByTestId("issue-status-dot");
    expect(dot).toHaveAttribute("title", "Status: In Progress");
    expect(dot).toHaveClass("relative", "z-[2]");
    const assignee = row.getByTestId("issue-assignee");
    expect(assignee).toHaveAttribute("title", "Unassigned");
    expect(assignee).toHaveClass("relative", "z-[2]");
  });

  it("announces an unassigned issue as Unassigned and an assignee by name and initials", () => {
    renderRows([
      makeIssue({ id: "a" }),
      makeIssue({
        id: "b",
        issueNumber: 13,
        assignedTo: ASSIGNEE_ID,
        assignedToUser: { id: ASSIGNEE_ID, name: "Priya Shah" },
      }),
    ]);
    const [unassigned, assigned] = screen.getAllByRole("listitem");
    if (!unassigned || !assigned) throw new Error("expected 2 rows");

    expect(within(unassigned).getByRole("img", { name: "Unassigned" })).toBe(
      within(unassigned).getByTestId("issue-assignee")
    );
    expect(
      within(assigned).getByRole("img", { name: "Assigned to Priya Shah" })
    ).toHaveTextContent("PS");
  });
});

describe("Issue row line 2 fit (issues-list §3.9)", () => {
  /**
   * jsdom lays nothing out, so line 2 and each measured part get widths:
   * ID 60, the "·" 4, machine 110, priority 50, assignee 30, comments 40,
   * age 90. The left group (ID, "·", machine, priority) has 6px gaps,
   * the right group (assignee, comments, age) 8px gaps, and at least 12px
   * separates the groups while the right one shows anything.
   */
  const PART_WIDTHS: Record<string, number> = {
    id: 60,
    "·": 4,
    machine: 110,
    priority: 50,
    assignee: 30,
    comments: 40,
    age: 90,
  };

  function stubLayout(lineWidth: number): void {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const isLine = this.hasAttribute("data-row-line");
        const width = isLine
          ? lineWidth
          : (PART_WIDTHS[this.getAttribute("data-measure") ?? ""] ?? 0);
        return DOMRect.fromRect({ width, height: 20 });
      }
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Each width is the parts' total plus the 16px fit tolerance. The left
  // group is 60+6+4+6+110+6+50 = 242 with the priority, 186 without.
  it.each<[number, string[]]>([
    // 242 + 12 + (30+8+40+8+90) = 430.
    [
      446,
      [
        "issue-id",
        "issue-machine",
        "issue-priority",
        "issue-assignee",
        "issue-comment-count",
        "issue-age",
      ],
    ],
    // The age drops first.
    [
      445,
      [
        "issue-id",
        "issue-machine",
        "issue-priority",
        "issue-assignee",
        "issue-comment-count",
      ],
    ],
    // 242 + 12 + (30+8+40) = 332; then the comment count.
    [347, ["issue-id", "issue-machine", "issue-priority", "issue-assignee"]],
    // 242 + 12 + 30 = 284; then the priority.
    [299, ["issue-id", "issue-machine", "issue-assignee"]],
    // 186 + 12 + 30 = 228; the assignee goes last. The ID never drops.
    [243, ["issue-id", "issue-machine"]],
    [120, ["issue-id", "issue-machine"]],
  ])("with comments, at %ipx shows %j", (lineWidth, expected) => {
    stubLayout(lineWidth);
    renderRows([makeIssue({ commentCount: 3 })]);
    expect(line2Parts(screen.getByRole("listitem"))).toEqual(expected);
  });

  it("without comments, drops the priority right after the age", () => {
    // 242 + 12 + (30+8+90) = 382: no comment part takes room.
    stubLayout(398);
    renderRows([makeIssue()]);
    expect(line2Parts(screen.getByRole("listitem"))).toEqual([
      "issue-id",
      "issue-machine",
      "issue-priority",
      "issue-assignee",
      "issue-age",
    ]);
    cleanup();

    // 242 + 12 + 30 = 284.
    stubLayout(299);
    renderRows([makeIssue()]);
    expect(line2Parts(screen.getByRole("listitem"))).toEqual([
      "issue-id",
      "issue-machine",
      "issue-assignee",
    ]);
  });

  it("keeps the right group after the left as its parts drop", () => {
    stubLayout(347);
    renderRows([makeIssue({ commentCount: 3 })]);
    const [left, right] = line2Groups(screen.getByRole("listitem"));
    if (!left || !right) throw new Error("expected 2 groups");

    expect(groupParts(left)).toEqual([
      "issue-id",
      "·",
      "issue-machine",
      "issue-priority",
    ]);
    expect(groupParts(right)).toEqual(["issue-assignee"]);
  });

  it("keeps a dropped part readable to screen readers", () => {
    stubLayout(237);
    renderRows([makeIssue({ commentCount: 3 })]);
    const row = within(screen.getByRole("listitem"));

    expect(row.getByTestId("issue-priority")).toHaveTextContent(
      "Priority: High"
    );
    expect(row.getByRole("img", { name: "Unassigned" })).toBeInTheDocument();
    expect(row.getByTestId("issue-comment-count")).toHaveTextContent(
      "3 comments"
    );
  });
});
