import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditableIssueTitle } from "./editable-issue-title";
import * as actions from "~/app/(app)/issues/actions";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const updateIssueTitleSpy = vi.spyOn(actions, "updateIssueTitleAction");

// The component schedules an onBlur cancel via window.setTimeout(_, 200).
// We can't use vi.useFakeTimers globally because RTL's `waitFor` polls via
// setTimeout and `useActionState`'s async resolution path interacts badly
// with faked timers — both hang. Instead we wait just past the 200ms
// threshold (250ms) — deterministic (the cancel decision is made at 200ms
// regardless of system load) and only ~750ms total wall-clock for all 3
// tests in this file.
const BLUR_TIMEOUT_MS = 200;
const AFTER_BLUR_TIMEOUT_MS = 250;

const waitPastBlurTimeout = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, AFTER_BLUR_TIMEOUT_MS));

describe("EditableIssueTitle", () => {
  beforeEach(() => {
    updateIssueTitleSpy.mockReset();
  });

  it("preserves typed edit on blur when server returns an error (PP-az4)", async () => {
    const user = userEvent.setup();
    updateIssueTitleSpy.mockResolvedValue({
      ok: false,
      code: "SERVER",
      message: "Save failed",
    });

    render(
      <EditableIssueTitle
        issueId="issue-1"
        title="Original Title"
        canEdit={true}
      />
    );

    await user.click(screen.getByLabelText("Edit title"));

    const input = screen.getByLabelText("Edit issue title");
    await user.clear(input);
    await user.type(input, "New typed text");

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(updateIssueTitleSpy).toHaveBeenCalled();
    });

    await user.tab();
    await waitPastBlurTimeout();

    const inputAfter = screen.getByLabelText("Edit issue title");
    expect(inputAfter).toBeInTheDocument();
    expect(inputAfter).toHaveValue("New typed text");
  });

  it("cancels on blur when no submission has errored", async () => {
    const user = userEvent.setup();

    render(
      <EditableIssueTitle
        issueId="issue-1"
        title="Original Title"
        canEdit={true}
      />
    );

    await user.click(screen.getByLabelText("Edit title"));
    const input = screen.getByLabelText("Edit issue title");
    await user.clear(input);
    await user.type(input, "Wandering edit");

    await user.tab();

    await waitFor(
      () => {
        expect(
          screen.queryByLabelText("Edit issue title")
        ).not.toBeInTheDocument();
      },
      { timeout: BLUR_TIMEOUT_MS + 200 }
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Original Title");
  });

  it("restores normal blur-cancel after Escape from a previously errored session (PP-az4)", async () => {
    // Regression for the session-counter pattern: a stale state.ok=false
    // from a previously-canceled edit session must not block auto-cancel
    // on a fresh edit session.
    const user = userEvent.setup();
    updateIssueTitleSpy.mockResolvedValue({
      ok: false,
      code: "SERVER",
      message: "Save failed",
    });

    render(
      <EditableIssueTitle
        issueId="issue-1"
        title="Original Title"
        canEdit={true}
      />
    );

    // Session 1: enter edit, submit, error, then Escape to abandon
    await user.click(screen.getByLabelText("Edit title"));
    let input = screen.getByLabelText("Edit issue title");
    await user.clear(input);
    await user.type(input, "First attempt");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(updateIssueTitleSpy).toHaveBeenCalledTimes(1);
    });
    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("Edit issue title")).not.toBeInTheDocument();

    // Session 2: re-enter edit mode. State.ok is still false from session 1,
    // but the session counter should make the onBlur cancel normally.
    await user.click(screen.getByLabelText("Edit title"));
    input = screen.getByLabelText("Edit issue title");
    await user.clear(input);
    await user.type(input, "Second attempt");

    await user.tab();

    await waitFor(
      () => {
        expect(
          screen.queryByLabelText("Edit issue title")
        ).not.toBeInTheDocument();
      },
      { timeout: BLUR_TIMEOUT_MS + 200 }
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Original Title");
  });
});
