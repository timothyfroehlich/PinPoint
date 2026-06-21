/**
 * IssueSubtitle reporter display tests
 *
 * The "subtitle" area on the issue detail page renders the reporter name inline
 * inside page.tsx (a Next.js Server Component).  Server Components cannot be
 * rendered in RTL, so these tests exercise IssueRow — the closest client
 * component that shares the same resolveIssueReporter() call and "by <name>"
 * output that the subtitle produces.  Any regression in reporter-name display
 * (wrong name, leaked email, missing fallback) would surface in both.
 *
 * Rule #12 regression guard: reporter email addresses must NEVER appear in any
 * rendered output.  Test "email-only guest shows Anonymous, never the email"
 * below is the canonical coverage for AGENTS.md commandment #12.
 *
 * Audit row 11 (DOWNGRADE-unit): replaces 6 of 7 tests from
 * e2e/full/reporter-variations.spec.ts.  The remaining 1 test (class-E
 * integration) lives in
 * src/test/integration/supabase/issue-services.test.ts.
 */

import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { IssueRow } from "./IssueRow";

// Wrap in TooltipProvider because IssueBadgeGrid (rendered inside IssueRow)
// uses Radix Tooltip, and the global provider lives in ClientProviders which
// is not rendered in unit tests.
function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

/**
 * Checks that the rendered output contains a reporter with the given name.
 * PersonHoverCard splits the "by" text and the name into separate DOM nodes
 * (a text node and a <span>/<a>), so a simple getByText(/by Name/) no longer
 * works. This helper finds the metadata line by its container and checks the
 * full text content.
 */
function expectReporterName(name: string) {
  // PersonHoverCard splits "by" and the name into separate DOM nodes, so a
  // simple getByText(/by Name/) no longer matches a single text node.
  // Check the full body text content instead.
  const text = document.body.textContent ?? "";
  expect(text).toContain(`by ${name}`);
}

// IssueRow renders a Next/Link; resolve it to a plain anchor so jsdom is happy.
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

const BASE_ISSUE = {
  id: "issue-1",
  issueNumber: 1,
  title: "Test Issue",
  status: "new" as const,
  severity: "major" as const,
  priority: "medium" as const,
  frequency: "frequent" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  machineInitials: "AFM",
  reporterName: null,
  machine: { name: "Attack from Mars" },
  reportedByUser: null,
  invitedReporter: null,
} as const;

describe("IssueRow reporter display (subtitle regression)", () => {
  it("displays confirmed member reporter name", () => {
    // Bug class D: reporter.name comes from reportedByUser.name when present.
    renderWithProviders(
      <IssueRow
        issue={{
          ...BASE_ISSUE,
          reportedByUser: { name: "Member User" },
        }}
      />
    );
    expectReporterName("Member User");
  });

  it("displays guest reporter name when both name and email are present", () => {
    // Bug class D: reporterName takes precedence over reporterEmail; the name
    // is shown, not the email.  Matches E2E scenario "John Guest" +
    // "john@guest.com" — only the name must appear.
    renderWithProviders(
      <IssueRow
        issue={{
          ...BASE_ISSUE,
          reporterName: "John Guest",
        }}
      />
    );
    expectReporterName("John Guest");
  });

  it("displays guest reporter name when name only is present", () => {
    // Bug class D: name-only guest (no email on the record).
    renderWithProviders(
      <IssueRow
        issue={{
          ...BASE_ISSUE,
          reporterName: "League Player",
        }}
      />
    );
    expectReporterName("League Player");
  });

  it("shows Anonymous when email-only guest (Rule #12 regression guard)", () => {
    // Bug class D + Rule #12: when a public reporter supplied only their email
    // (reporterEmail is stored in the DB but NOT in the IssueReporterInfo
    // interface, so resolveIssueReporter() never sees it).  The display must
    // fall back to "Anonymous", never the email address.
    //
    // This is the canonical regression guard for AGENTS.md commandment #12:
    // if anyone accidentally adds reporterEmail to the interface or the
    // rendering path, this test fails.
    renderWithProviders(
      <IssueRow
        issue={{
          ...BASE_ISSUE,
          // Neither reportedByUser, invitedReporter, nor reporterName is set —
          // simulating the "email only" case where only reporterEmail exists in
          // the DB.  resolveIssueReporter() has no reporterEmail field and
          // therefore falls back to "Anonymous".
          reporterName: null,
          reportedByUser: null,
          invitedReporter: null,
        }}
      />
    );
    expectReporterName("Anonymous");
  });

  it("shows Anonymous for fully anonymous reporter", () => {
    // Bug class D: no reporter fields at all — the fully anonymous case.
    renderWithProviders(
      <IssueRow
        issue={{
          ...BASE_ISSUE,
          reporterName: null,
          reportedByUser: null,
          invitedReporter: null,
        }}
      />
    );
    expectReporterName("Anonymous");
  });

  it("displays invited user (legacy invitedReporter) name", () => {
    // Bug class D: invitedReporter.name is the legacy "Invited Guest" path.
    renderWithProviders(
      <IssueRow
        issue={{
          ...BASE_ISSUE,
          invitedReporter: { name: "Invited Guest" },
        }}
      />
    );
    expectReporterName("Invited Guest");
  });
});
