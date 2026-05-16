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

describe("EditableIssueTitle", () => {
  beforeEach(() => {
    updateIssueTitleSpy.mockReset();
  });

  it("preserves typed edit on blur when server returns an error (PP-az4)", async () => {
    // Regression: previously, after a failed save the user moving focus to
    // read the error toast triggered the onBlur auto-cancel, silently
    // discarding their typed edit. The fix skips auto-cancel when
    // state.ok === false.
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

    // Move focus away (simulates user clicking the toast or elsewhere)
    await user.tab();

    // Wait past the 200ms onBlur timeout
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Edit form should still be open with typed text preserved
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
      { timeout: 1000 }
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Original Title");
  });
});
