/**
 * Regression guard for PP-1ajq on `UnifiedReportForm`.
 *
 * The metadata Selects here are controlled off the shared report draft
 * (`value={entry.severity}` / `onValueChange={patchEntry}`), which does NOT
 * make them safe: @radix-ui/react-select >=2.3.3 replays each Select's
 * mount-time value through `onValueChange` on a form `reset`, so the replay
 * writes the STALE value straight back into the draft. React 19 fires that
 * reset automatically once a `<form action={...}>` action settles — failure
 * included — and a rejected report leaves the form on screen. The reporter's
 * Severity/Frequency choices were therefore silently undone while they were
 * still reading the error message.
 *
 * This file deliberately mocks neither `react` (so `useActionState` is real)
 * nor the four field Selects (so the real Radix interaction runs). The
 * sibling suite `src/app/(app)/report/unified-report-form.test.tsx` mocks
 * both, which is exactly why this bug class stayed invisible to a green suite
 * (PP-0fvr).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { UnifiedReportForm } from "~/app/(app)/report/unified-report-form";
import { ReportDraftProvider } from "~/app/(app)/report/report-draft-store";
import {
  serializeDraft,
  defaultEntry,
  emptySingle,
  DRAFT_VERSION,
  REPORT_DRAFT_KEY,
  type ReportDraft,
} from "~/app/(app)/report/report-draft-schema";
import type { MachineOption } from "~/components/machines/MachineCombobox";
import { submitPublicIssueAction } from "~/app/(app)/report/actions";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("~/app/(app)/report/actions", () => ({
  submitPublicIssueAction: vi.fn(),
  getRecentIssuesAction: vi.fn().mockResolvedValue({ ok: true, value: [] }),
}));

// Heavy children, stubbed — none of them participate in the reset path.
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({ ariaLabel }: { ariaLabel: string }) => (
    <div aria-label={ariaLabel} data-testid="rich-text-editor" />
  ),
}));
vi.mock("~/components/images/ImageUploadButton", () => ({
  ImageUploadButton: () => <div data-testid="image-upload-button" />,
}));
vi.mock("~/components/images/ImageGallery", () => ({
  ImageGallery: () => <div data-testid="image-gallery" />,
}));
vi.mock("~/components/issues/RecentIssuesPanelClient", () => ({
  RecentIssuesPanelClient: () => <div data-testid="recent-issues" />,
}));

const MACHINE = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Addams Family",
  initials: "AF",
};

const MACHINE_OPTIONS: MachineOption[] = [
  { value: MACHINE.id, name: MACHINE.name, initials: MACHINE.initials },
];

/** Seed a draft that already has a machine picked, so submit is enabled. */
function seedDraftWithMachine(): void {
  const draft: ReportDraft = {
    version: DRAFT_VERSION,
    entries: [
      {
        ...defaultEntry(randomUUID()),
        machineId: MACHINE.id,
        title: "Left flipper is weak",
      },
    ],
    single: emptySingle(),
  };
  localStorage.setItem(REPORT_DRAFT_KEY, serializeDraft(draft));
}

/**
 * Mirrors the `(tabbed)` layout: the provider outlives the Single form, which
 * unmounts on every Single↔Multiple tab switch. Toggling `showSingle` is how a
 * test reproduces a remount that starts from a non-default draft.
 */
function Tabbed({ showSingle }: { showSingle: boolean }): React.JSX.Element {
  return (
    <ReportDraftProvider machines={MACHINE_OPTIONS} assignees={[]}>
      {showSingle ? (
        <UnifiedReportForm
          machinesList={[MACHINE]}
          defaultMachineId={undefined}
          userAuthenticated={false}
          accessLevel="unauthenticated"
          assignees={[]}
          initialIssues={[]}
          initialMachineInitials=""
        />
      ) : (
        <div data-testid="quick-tab" />
      )}
    </ReportDraftProvider>
  );
}

function wrapped(): React.JSX.Element {
  return <Tabbed showSingle={true} />;
}

function severityHidden(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    'input[name="severity"]'
  );
  if (!input) throw new Error('hidden input[name="severity"] not found');
  return input;
}

describe("UnifiedReportForm — a failed submit must not revert the metadata Selects (PP-1ajq)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(submitPublicIssueAction).mockResolvedValue({
      error: "Could not file that report. Please try again.",
    });
  });

  it("keeps the chosen Severity after the action fails", async () => {
    const user = userEvent.setup();
    seedDraftWithMachine();
    render(wrapped());

    // Draft default is "minor"; move it to "Major" through real Radix.
    await waitFor(() => {
      expect(severityHidden().value).toBe("minor");
    });
    await user.click(screen.getByLabelText(/Severity/));
    await user.click(screen.getByRole("option", { name: "Major" }));
    expect(severityHidden().value).toBe("major");

    await user.click(
      screen.getByRole("button", { name: "Submit Issue Report" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Could not file that report. Please try again.")
      ).toBeInTheDocument();
    });

    // Let React's post-action reset commit before asserting it didn't land.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(severityHidden().value).toBe("major");
  });

  /**
   * The same Radix replay reaches the EXPLICIT reset too. `resetSingleForm()`
   * still calls `formRef.current.reset()` to clear the honeypot, so the order
   * of that call against the draft-clearing state updates decides who wins —
   * they all land in one React batch. Reset must go first.
   *
   * The replay is only harmful when the Selects mounted at a non-default value,
   * which is what the tab switch below sets up: mount-time "major" is stale
   * once the user moves to "unplayable", so a Clear restored "major".
   */
  it("clears the Selects when the mount-time value is stale after a tab switch", async () => {
    const user = userEvent.setup();
    seedDraftWithMachine();
    const { rerender } = render(<Tabbed showSingle={true} />);

    await waitFor(() => {
      expect(severityHidden().value).toBe("minor");
    });
    await user.click(screen.getByLabelText(/Severity/));
    await user.click(screen.getByRole("option", { name: "Major" }));
    expect(severityHidden().value).toBe("major");

    // Single → Multiple → Single. The form remounts; the draft does not.
    rerender(<Tabbed showSingle={false} />);
    rerender(<Tabbed showSingle={true} />);
    await waitFor(() => {
      expect(severityHidden().value).toBe("major");
    });

    // Now move off the mount-time value, so a replay of it would be stale.
    await user.click(screen.getByLabelText(/Severity/));
    await user.click(screen.getByRole("option", { name: "Unplayable" }));
    expect(severityHidden().value).toBe("unplayable");

    await user.click(screen.getByRole("button", { name: /Clear/i }));
    await user.click(screen.getByRole("button", { name: "Clear fields" }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(severityHidden().value).toBe("minor");
  });
});
