/**
 * RTL Unit Tests: IssueList bottom pagination buttons
 *
 * Covers the "Issues List Pagination > should have bottom pagination buttons
 * that work" test from e2e/full/issues-crud-extended.spec.ts (audit row 7,
 * class-H pure UI state). These tests are cheaper at the RTL layer because
 * the enable/disable state and the click handler are pure component logic —
 * no real router or browser needed.
 *
 * Test IDs exercised: data-testid="bottom-prev-page" and
 * data-testid="bottom-next-page" (rendered in IssueList.tsx inside the
 * totalCount > 0 bottom pagination bar).
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IssueList } from "./IssueList";
import type { IssueListItem } from "~/lib/types";

// ---------------------------------------------------------------------------
// Mock next/navigation — IssueList uses useSearchParams (directly) and
// useSearchFilters which uses useRouter + usePathname.
// ---------------------------------------------------------------------------
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/issues",
}));

// ---------------------------------------------------------------------------
// Mock next/link to avoid jsdom navigation errors.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Mock server actions imported by IssueList (inline-edit handlers).
// These are not exercised by pagination tests but must resolve without error.
// ---------------------------------------------------------------------------
vi.mock("~/app/(app)/issues/actions", () => ({
  updateIssueStatusAction: vi.fn(),
  updateIssueSeverityAction: vi.fn(),
  updateIssuePriorityAction: vi.fn(),
  assignIssueAction: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock ExportButton — the export server action needs a Supabase client.
// ---------------------------------------------------------------------------
vi.mock("~/components/issues/ExportButton", () => ({
  ExportButton: () => <button type="button">Export</button>,
}));

// ---------------------------------------------------------------------------
// Mock sonner toast used inside IssueList transition handlers.
// ---------------------------------------------------------------------------
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock storeLastIssuesPath so jsdom cookie writes don't cause noise.
// ---------------------------------------------------------------------------
vi.mock("~/lib/cookies/client", () => ({
  storeLastIssuesPath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock useTableResponsiveColumns to return all columns visible.
// The hook uses ResizeObserver which is unavailable in jsdom. For these tests
// we only care about the pagination bar, not the column layout.
// ---------------------------------------------------------------------------
vi.mock("~/hooks/use-table-responsive-columns", () => ({
  useTableResponsiveColumns: () => ({
    visibleColumns: {
      status: true,
      priority: true,
      severity: true,
      assignee: true,
      modified: true,
    },
    containerRef: { current: null },
  }),
}));

// ---------------------------------------------------------------------------
// Minimal IssueListItem fixture factory
// ---------------------------------------------------------------------------
function makeIssue(n: number): IssueListItem {
  return {
    id: `issue-${n}`,
    issueNumber: n,
    title: `Issue ${n}`,
    status: "new",
    severity: "minor",
    priority: "medium",
    frequency: "intermittent",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    machineInitials: "AFM",
    reporterName: null,
    assignedTo: null,
    machine: { id: "machine-1", name: "Attack from Mars" },
    reportedByUser: null,
    invitedReporter: null,
    assignedToUser: null,
  };
}

const DEFAULT_PROPS = {
  sort: "updated_desc",
  allUsers: [],
};

describe("IssueList bottom pagination buttons (audit row 7, class-H)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when there is only one page of results", () => {
    it("renders both bottom pagination buttons", () => {
      const issues = [makeIssue(1), makeIssue(2)];
      render(
        <IssueList
          {...DEFAULT_PROPS}
          issues={issues}
          totalCount={2}
          page={1}
          pageSize={15}
        />
      );

      expect(screen.getByTestId("bottom-prev-page")).toBeInTheDocument();
      expect(screen.getByTestId("bottom-next-page")).toBeInTheDocument();
    });

    it("disables both buttons on the only page", () => {
      const issues = [makeIssue(1), makeIssue(2)];
      render(
        <IssueList
          {...DEFAULT_PROPS}
          issues={issues}
          totalCount={2}
          page={1}
          pageSize={15}
        />
      );

      expect(screen.getByTestId("bottom-prev-page")).toBeDisabled();
      expect(screen.getByTestId("bottom-next-page")).toBeDisabled();
    });
  });

  describe("when there are multiple pages", () => {
    it("disables prev and enables next on the first page", () => {
      const issues = Array.from({ length: 15 }, (_, i) => makeIssue(i + 1));
      render(
        <IssueList
          {...DEFAULT_PROPS}
          issues={issues}
          totalCount={30}
          page={1}
          pageSize={15}
        />
      );

      expect(screen.getByTestId("bottom-prev-page")).toBeDisabled();
      expect(screen.getByTestId("bottom-next-page")).toBeEnabled();
    });

    it("enables prev and disables next on the last page", () => {
      const issues = Array.from({ length: 5 }, (_, i) => makeIssue(i + 16));
      render(
        <IssueList
          {...DEFAULT_PROPS}
          issues={issues}
          totalCount={20}
          page={2}
          pageSize={15}
        />
      );

      expect(screen.getByTestId("bottom-prev-page")).toBeEnabled();
      expect(screen.getByTestId("bottom-next-page")).toBeDisabled();
    });

    it("enables both buttons on a middle page", () => {
      const issues = Array.from({ length: 15 }, (_, i) => makeIssue(i + 16));
      render(
        <IssueList
          {...DEFAULT_PROPS}
          issues={issues}
          totalCount={45}
          page={2}
          pageSize={15}
        />
      );

      expect(screen.getByTestId("bottom-prev-page")).toBeEnabled();
      expect(screen.getByTestId("bottom-next-page")).toBeEnabled();
    });

    it("clicking next-page calls router.push with page=2", async () => {
      const user = userEvent.setup();
      const issues = Array.from({ length: 15 }, (_, i) => makeIssue(i + 1));
      render(
        <IssueList
          {...DEFAULT_PROPS}
          issues={issues}
          totalCount={30}
          page={1}
          pageSize={15}
        />
      );

      await user.click(screen.getByTestId("bottom-next-page"));

      expect(mockPush).toHaveBeenCalledTimes(1);
      const calledUrl = mockPush.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("page=2");
    });

    it("clicking prev-page calls router.push without a page param (back to page 1)", async () => {
      const user = userEvent.setup();
      const issues = Array.from({ length: 15 }, (_, i) => makeIssue(i + 16));
      render(
        <IssueList
          {...DEFAULT_PROPS}
          issues={issues}
          totalCount={30}
          page={2}
          pageSize={15}
        />
      );

      await user.click(screen.getByTestId("bottom-prev-page"));

      expect(mockPush).toHaveBeenCalledTimes(1);
      const calledUrl = mockPush.mock.calls[0]?.[0] as string;
      // page=1 is the default and is omitted from the URL per useSearchFilters
      expect(calledUrl).not.toContain("page=");
    });
  });

  describe("when there are no issues", () => {
    it("does not render the bottom pagination bar", () => {
      render(
        <IssueList
          {...DEFAULT_PROPS}
          issues={[]}
          totalCount={0}
          page={1}
          pageSize={15}
        />
      );

      expect(screen.queryByTestId("bottom-prev-page")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bottom-next-page")).not.toBeInTheDocument();
    });
  });
});
