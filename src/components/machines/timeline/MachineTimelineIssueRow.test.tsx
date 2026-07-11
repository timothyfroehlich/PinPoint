import { render, screen } from "@testing-library/react";
import { createRef, type ReactElement, type RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import type { MachineIssueEventData } from "~/lib/timeline/machine-event-types";
import type { ResolvedMachineRef } from "~/lib/timeline/machine-events";
import type { ResolvedPerson } from "~/lib/timeline/resolve-person";

import {
  MachineTimelineIssueRow,
  type MachineIssueRowData,
} from "./MachineTimelineIssueRow";

// IssueBadge wraps its label in a Radix Tooltip; the global provider lives in
// ClientProviders in real renders. Wrap all renders so badge-rendering tests
// don't blow up with "Tooltip must be used within TooltipProvider".
function renderRow(ui: ReactElement): ReturnType<typeof render> {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

// The density hook starts as `"compact"` and only widens after a
// ResizeObserver sees the row body pass a threshold. jsdom has no real layout,
// so observe never fires — we mock the hook and drive `density` per-test via
// this hoisted holder (default `"full"` so actor + both-badge assertions
// exercise the widest branch). Tests that care about narrow behaviour set
// `densityMock.value` before rendering and reset it afterwards.
const densityMock = vi.hoisted<{
  value: "full" | "no-actor" | "compact";
}>(() => ({ value: "full" }));
vi.mock("~/hooks/use-timeline-row-density", () => ({
  useTimelineRowDensity: (): {
    density: "full" | "no-actor" | "compact";
    containerRef: RefObject<HTMLDivElement | null>;
  } => ({
    density: densityMock.value,
    containerRef: createRef<HTMLDivElement | null>(),
  }),
}));

// RelativeTime uses setInterval + useEffect; in jsdom it renders the ISO
// fallback on first paint and then ticks. Stub it to a stable placeholder so
// the "right meta" assertions don't depend on locale-formatted time.
vi.mock("~/components/issues/RelativeTime", () => ({
  RelativeTime: () => <span data-testid="relative-time">RELTIME</span>,
}));

const baseCreatedAt = new Date("2026-05-17T12:00:00Z");

function makeRow(
  eventData: MachineIssueEventData,
  overrides: {
    authorName?: string | null;
    people?: Record<string, ResolvedPerson>;
    machineRefs?: Record<string, ResolvedMachineRef>;
  } = {}
): MachineIssueRowData {
  return {
    id: "row-1",
    createdAt: baseCreatedAt,
    tag: "issue",
    authorName: overrides.authorName ?? null,
    eventData,
    people: overrides.people ?? {},
    machineRefs: overrides.machineRefs ?? {},
  };
}

const ISSUE_ID = "00000000-0000-0000-0000-000000000001";

describe("MachineTimelineIssueRow", () => {
  describe("issue_opened actor resolution", () => {
    it("renders 'by Alice' for a real reporter people-row", () => {
      const row = makeRow(
        {
          kind: "issue_opened",
          issueId: ISSUE_ID,
          issueNumber: 3,
          title: "Broken flipper",
        },
        {
          people: {
            reporter: { displayName: "Alice", isInvited: false },
          },
        }
      );
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      // No suffix on a real user.
      expect(screen.queryByText(/\(invited\)/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\(guest\)/i)).not.toBeInTheDocument();
    });

    it("appends '(invited)' for an invited reporter people-row", () => {
      const row = makeRow(
        {
          kind: "issue_opened",
          issueId: ISSUE_ID,
          issueNumber: 3,
          title: "Broken flipper",
        },
        {
          people: {
            reporter: { displayName: "Alice", isInvited: true },
          },
        }
      );
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText(/\(invited\)/)).toBeInTheDocument();
    });

    it("falls back to guestReporterName with '(guest)' when no reporter row", () => {
      const row = makeRow(
        {
          kind: "issue_opened",
          issueId: ISSUE_ID,
          issueNumber: 3,
          title: "Broken flipper",
          guestReporterName: "Bob",
        },
        { people: {} }
      );
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText(/\(guest\)/)).toBeInTheDocument();
    });

    it("renders 'Anonymous' when no reporter row, no guestReporterName, no authorName", () => {
      const row = makeRow(
        {
          kind: "issue_opened",
          issueId: ISSUE_ID,
          issueNumber: 3,
          title: "Broken flipper",
        },
        { people: {}, authorName: null }
      );
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText("Anonymous")).toBeInTheDocument();
    });

    it("falls back to authorName when no reporter row and no guestReporterName", () => {
      const row = makeRow(
        {
          kind: "issue_opened",
          issueId: ISSUE_ID,
          issueNumber: 3,
          title: "Broken flipper",
        },
        { people: {}, authorName: "AuthorName" }
      );
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText("AuthorName")).toBeInTheDocument();
    });
  });

  describe("other issue kinds use authorName for the actor clause", () => {
    it("issue_status_changed renders 'by <authorName>'", () => {
      const row = makeRow(
        {
          kind: "issue_status_changed",
          issueId: ISSUE_ID,
          issueNumber: 3,
          from: "new",
          to: "in_progress",
        },
        { authorName: "Tech Tim" }
      );
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText("Tech Tim")).toBeInTheDocument();
    });
  });

  describe("issue_assigned verb clause", () => {
    it("renders 'assigned to <name>' when assignee people-row is present", () => {
      const row = makeRow(
        {
          kind: "issue_assigned",
          issueId: ISSUE_ID,
          issueNumber: 3,
        },
        {
          authorName: "Admin",
          people: {
            assignee: { displayName: "Casey", isInvited: false },
          },
        }
      );
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText(/assigned to Casey/)).toBeInTheDocument();
    });

    it("renders 'assigned to someone' when assignee row is missing", () => {
      const row = makeRow(
        {
          kind: "issue_assigned",
          issueId: ISSUE_ID,
          issueNumber: 3,
        },
        { authorName: "Admin", people: {} }
      );
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText(/assigned to someone/)).toBeInTheDocument();
    });
  });

  describe("reassign rows", () => {
    it("issue_reassigned_out renders 'moved to <machineName>' and the ID is NOT a link", () => {
      const row = makeRow(
        {
          kind: "issue_reassigned_out",
          issueId: ISSUE_ID,
          issueNumber: 3,
          toMachineId: "machine-b",
          title: "Broken target",
        },
        {
          machineRefs: {
            "machine-b": { name: "Iron Maiden", initials: "IM" },
          },
        }
      );
      const { container } = renderRow(
        <MachineTimelineIssueRow row={row} machineInitials="AFM" />
      );
      expect(screen.getByText(/moved to Iron Maiden/)).toBeInTheDocument();
      // The ID text renders, but is NOT wrapped in an anchor — reassign-out
      // rows point to a now-different machine and shouldn't link to the old
      // /m/AFM/i/<n> path.
      expect(screen.getByText("AFM-03")).toBeInTheDocument();
      expect(container.querySelector("a")).toBeNull();
    });

    it("issue_reassigned_in renders 'received from <machineName>' and IS linkable", () => {
      const row = makeRow(
        {
          kind: "issue_reassigned_in",
          issueId: ISSUE_ID,
          issueNumber: 3,
          fromMachineId: "machine-a",
        },
        {
          machineRefs: {
            "machine-a": { name: "Attack from Mars", initials: "AFM" },
          },
        }
      );
      const { container } = renderRow(
        <MachineTimelineIssueRow row={row} machineInitials="IM" />
      );
      expect(
        screen.getByText(/received from Attack from Mars/)
      ).toBeInTheDocument();
      // ID renders as a link to the NEW host machine.
      const link = container.querySelector("a");
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe("/m/IM/i/3");
    });
  });

  describe("issue ID linking + formatting", () => {
    it("renders the formatted ID as a link when machineInitials is provided (non-reassign-out kind)", () => {
      const row = makeRow({
        kind: "issue_opened",
        issueId: ISSUE_ID,
        issueNumber: 3,
        title: "Broken flipper",
      });
      const { container } = renderRow(
        <MachineTimelineIssueRow row={row} machineInitials="AFM" />
      );
      expect(screen.getByText("AFM-03")).toBeInTheDocument();
      // The ID anchor lives on line 1; there may also be a title anchor on
      // line 2. Find the line-1 one by its href + text.
      const link = container.querySelector('a[href="/m/AFM/i/3"]');
      expect(link).not.toBeNull();
    });

    it("renders '#<n>' as plain text (no link) when machineInitials is undefined", () => {
      const row = makeRow({
        kind: "issue_opened",
        issueId: ISSUE_ID,
        issueNumber: 3,
        title: "Broken flipper",
      });
      const { container } = renderRow(<MachineTimelineIssueRow row={row} />);
      expect(screen.getByText("#3")).toBeInTheDocument();
      expect(container.querySelector("a")).toBeNull();
    });
  });

  describe("title rendering on line 2", () => {
    it("renders the title when present", () => {
      const row = makeRow({
        kind: "issue_opened",
        issueId: ISSUE_ID,
        issueNumber: 3,
        title: "Broken flipper",
      });
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText("Broken flipper")).toBeInTheDocument();
    });

    it("omits the title clause when eventData has no title", () => {
      const row = makeRow({
        kind: "issue_unassigned",
        issueId: ISSUE_ID,
        issueNumber: 3,
      });
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      // No "title" key on this eventData → no second-line text node beyond the
      // verb clause "unassigned" which lives on line 1. Sanity-check the
      // verb is present so the row mounted.
      expect(screen.getByText(/unassigned/)).toBeInTheDocument();
    });
  });

  describe("badges", () => {
    afterEach(() => {
      densityMock.value = "full";
    });

    it("issue_opened with severity renders a severity badge", () => {
      const row = makeRow({
        kind: "issue_opened",
        issueId: ISSUE_ID,
        issueNumber: 3,
        title: "Broken flipper",
        severity: "major",
      });
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      // IssueBadge "strip" variant renders an accessible label that contains
      // the severity name; match case-insensitively.
      expect(screen.getByText(/major/i)).toBeInTheDocument();
    });

    it("issue_opened with frequency renders a frequency badge", () => {
      const row = makeRow({
        kind: "issue_opened",
        issueId: ISSUE_ID,
        issueNumber: 3,
        title: "Broken flipper",
        frequency: "frequent",
      });
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText(/frequent/i)).toBeInTheDocument();
    });

    it("drops the frequency badge on the compact (narrow) tier, keeping severity", () => {
      densityMock.value = "compact";
      const row = makeRow({
        kind: "issue_opened",
        issueId: ISSUE_ID,
        issueNumber: 3,
        title: "Broken flipper",
        severity: "major",
        frequency: "frequent",
      });
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      // Severity stays; frequency is shed so ID + severity + timestamp fit a
      // narrow phone row without overlapping (PP-dnk8 mobile badge cap).
      expect(screen.getByText(/major/i)).toBeInTheDocument();
      expect(screen.queryByText(/frequent/i)).not.toBeInTheDocument();
    });

    it("keeps both badges on the no-actor (mid) tier", () => {
      densityMock.value = "no-actor";
      const row = makeRow({
        kind: "issue_opened",
        issueId: ISSUE_ID,
        issueNumber: 3,
        title: "Broken flipper",
        severity: "major",
        frequency: "frequent",
      });
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText(/major/i)).toBeInTheDocument();
      expect(screen.getByText(/frequent/i)).toBeInTheDocument();
    });

    it("issue_closed with closedAsStatus renders a status badge", () => {
      const row = makeRow({
        kind: "issue_closed",
        issueId: ISSUE_ID,
        issueNumber: 3,
        title: "Broken flipper",
        closedAsStatus: "fixed",
      });
      renderRow(<MachineTimelineIssueRow row={row} machineInitials="AFM" />);
      expect(screen.getByText(/fixed/i)).toBeInTheDocument();
    });
  });
});
