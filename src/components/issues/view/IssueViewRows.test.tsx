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

/** Line 2's text as shown, its screen-reader-only parts left out. */
function line2Parts(row: HTMLElement): string[] {
  const line = within(row).getByTestId("issue-machine").closest("div");
  if (!line) throw new Error("expected line 2");
  return Array.from(line.children)
    .filter((part) => !part.classList.contains("sr-only"))
    .map((part) => {
      const testId = part
        .querySelector("[data-testid]")
        ?.getAttribute("data-testid");
      return testId ?? part.getAttribute("data-testid") ?? "";
    });
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

  it("shows the title and the status and severity pills on line 1", () => {
    renderRows([makeIssue()]);
    const row = within(screen.getByRole("listitem"));

    expect(
      row.getByRole("link", {
        name: "Left flipper weak after the second multiball",
      })
    ).toHaveAttribute("href", "/m/AFM/i/12");
    expect(row.getByTestId("issue-status")).toHaveTextContent(
      "Status: In Progress"
    );
    expect(row.getByTestId("issue-severity")).toHaveTextContent(
      "Severity: Major"
    );
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
    // Phones show "2d"; desktop and screen readers get the long form.
    const age = row.getByTestId("issue-age");
    expect(age).toHaveAttribute("datetime", "2026-01-02T00:00:00.000Z");
    expect(age).toHaveTextContent("2dupdated 2d ago");
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
   * ID 60, machine 120, priority 50, assignee 30, comments 40, age 90, with
   * 6px gaps.
   */
  const PART_WIDTHS: Record<string, number> = {
    id: 60,
    machine: 120,
    priority: 50,
    assignee: 30,
    comments: 40,
    age: 90,
  };

  function stubLayout(lineWidth: number): void {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const isLine =
          this.querySelector(
            ':scope > span > [data-testid="issue-machine"]'
          ) !== null;
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

  // Each width is the parts' total plus the 16px fit tolerance.
  it.each<[number, string[]]>([
    // 60+120+50+30+40+90 + 5 gaps = 420.
    [
      436,
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
      435,
      [
        "issue-id",
        "issue-machine",
        "issue-priority",
        "issue-assignee",
        "issue-comment-count",
      ],
    ],
    // 60+120+50+30+40 + 4 gaps = 324; then the comment count.
    [339, ["issue-id", "issue-machine", "issue-priority", "issue-assignee"]],
    // 60+120+50+30 + 3 gaps = 278; then the priority.
    [293, ["issue-id", "issue-machine", "issue-assignee"]],
    // 60+120+30 + 2 gaps = 222; the assignee goes last. The ID never drops.
    [237, ["issue-id", "issue-machine"]],
    [120, ["issue-id", "issue-machine"]],
  ])("with comments, at %ipx shows %j", (lineWidth, expected) => {
    stubLayout(lineWidth);
    renderRows([makeIssue({ commentCount: 3 })]);
    expect(line2Parts(screen.getByRole("listitem"))).toEqual(expected);
  });

  it("without comments, drops the priority right after the age", () => {
    // 60+120+50+30+90 + 4 gaps = 374: no comment part takes room.
    stubLayout(390);
    renderRows([makeIssue()]);
    expect(line2Parts(screen.getByRole("listitem"))).toEqual([
      "issue-id",
      "issue-machine",
      "issue-priority",
      "issue-assignee",
      "issue-age",
    ]);
    cleanup();

    // 60+120+50+30 + 3 gaps = 278.
    stubLayout(293);
    renderRows([makeIssue()]);
    expect(line2Parts(screen.getByRole("listitem"))).toEqual([
      "issue-id",
      "issue-machine",
      "issue-assignee",
    ]);
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
