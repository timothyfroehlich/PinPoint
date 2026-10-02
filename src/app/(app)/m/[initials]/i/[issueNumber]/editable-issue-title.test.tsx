import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockMobileViewport } from "~/test/helpers/viewport";
import { EditableIssueTitle } from "./editable-issue-title";
import * as actions from "~/app/(app)/issues/actions";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mocked at the module boundary: the component wraps the action once, at
// module load, so a spy installed after import would never be called.
vi.mock("~/app/(app)/issues/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof actions>()),
  updateIssueTitleAction: vi.fn(),
}));

const updateIssueTitleSpy = vi.mocked(actions.updateIssueTitleAction);

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
    // The failure shows under the field and is tied to it, not only a toast.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Save failed");
    expect(inputAfter).toHaveAttribute("aria-invalid", "true");
    expect(inputAfter).toHaveAccessibleDescription(/^Save failed/);

    // Typing again clears it.
    await user.type(inputAfter, "!");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(inputAfter).not.toHaveAttribute("aria-invalid");
  });

  it("keeps the page's h1 while editing and announces reaching the limit", async () => {
    const user = userEvent.setup();
    render(
      <EditableIssueTitle
        issueId="issue-1"
        title="Original Title"
        canEdit={true}
      />
    );

    await user.click(screen.getByLabelText("Edit title"));
    expect(
      screen.getByRole("heading", { level: 1, name: "Original Title" })
    ).toBeInTheDocument();

    const input = screen.getByLabelText("Edit issue title");
    await user.clear(input);
    await user.type(input, "x".repeat(59));
    expect(screen.queryByText("59 of 60 characters")).not.toBeInTheDocument();
    await user.type(input, "x");
    expect(screen.getByText("60 of 60 characters")).toHaveAttribute(
      "aria-live",
      "polite"
    );
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

  it("opens with the cursor at the end, and Escape returns focus to Edit title", async () => {
    const user = userEvent.setup();
    render(
      <EditableIssueTitle issueId="issue-1" title="Original Title" canEdit />
    );

    const editButton = screen.getByRole("button", { name: "Edit title" });
    await user.click(editButton);
    const input = screen.getByLabelText("Edit issue title");
    expect(input).toHaveFocus();
    expect(input).toHaveProperty("selectionStart", "Original Title".length);
    expect(input).toHaveProperty("selectionEnd", "Original Title".length);
    expect(input).toHaveAccessibleDescription(/Enter saves\. Escape cancels\./);

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Edit title" })).toHaveFocus();
  });

  it("edits in a wrapping field that keeps the title on one logical line", async () => {
    const user = userEvent.setup();
    render(
      <EditableIssueTitle issueId="issue-1" title="Flipper" canEdit={true} />
    );

    await user.click(screen.getByLabelText("Edit title"));
    const input = screen.getByLabelText("Edit issue title");
    // A wrapping field, so a long title stays visible at 320px (§4.2).
    expect(input.tagName).toBe("TEXTAREA");

    fireEvent.change(input, { target: { value: "Left\nflipper weak" } });
    expect(input).toHaveValue("Left flipper weak");
  });

  it("does not save on the Enter that confirms an IME composition", async () => {
    const user = userEvent.setup();
    render(
      <EditableIssueTitle issueId="issue-1" title="Original Title" canEdit />
    );
    await user.click(screen.getByRole("button", { name: "Edit title" }));
    const input = screen.getByLabelText("Edit issue title");
    await user.type(input, " 日本");

    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(updateIssueTitleSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Edit issue title")).toBeInTheDocument();
  });

  it("returns focus to the Move button when the Move dialog closes", async () => {
    const user = userEvent.setup();
    render(
      <EditableIssueTitle
        issueId="issue-1"
        title="Original Title"
        canEdit
        move={{
          currentInitials: "AFM",
          machines: [
            { initials: "AFM", name: "Attack from Mars" },
            { initials: "TZ", name: "Twilight Zone" },
          ],
        }}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Move to another machine" })
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Move to another machine" })
      ).toHaveFocus();
    });
  });

  describe("on a phone", () => {
    let restoreViewport: () => void;
    beforeEach(() => {
      restoreViewport = mockMobileViewport(true);
    });
    afterEach(() => {
      restoreViewport();
    });

    async function openFromMenu(
      user: ReturnType<typeof userEvent.setup>
    ): Promise<HTMLElement> {
      await user.click(screen.getByRole("button", { name: "Issue actions" }));
      await user.click(
        await screen.findByRole("menuitem", { name: "Edit title" })
      );
      const input = await screen.findByLabelText("Edit issue title");
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      return input;
    }

    it("keeps the edit when the field loses focus; Cancel discards it and returns focus to the menu", async () => {
      const user = userEvent.setup();
      render(
        <EditableIssueTitle issueId="issue-1" title="Original Title" canEdit />
      );
      const input = await openFromMenu(user);
      expect(input).toHaveAttribute("enterkeyhint", "done");
      await user.type(input, " edited");

      await user.click(document.body);
      await waitPastBlurTimeout();
      expect(screen.getByLabelText("Edit issue title")).toHaveValue(
        "Original Title edited"
      );

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("heading")).toHaveTextContent("Original Title");
      expect(
        screen.getByRole("button", { name: "Issue actions" })
      ).toHaveFocus();
    });

    it("Save submits the edited title", async () => {
      const user = userEvent.setup();
      updateIssueTitleSpy.mockResolvedValue({
        ok: true,
        value: { issueId: "issue-1" },
      });
      render(
        <EditableIssueTitle issueId="issue-1" title="Original Title" canEdit />
      );
      const input = await openFromMenu(user);
      await user.type(input, " edited");

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(updateIssueTitleSpy).toHaveBeenCalledTimes(1);
      });
      const formData = updateIssueTitleSpy.mock.calls[0]?.[1];
      expect(formData).toBeInstanceOf(FormData);
      if (formData instanceof FormData) {
        expect(formData.get("title")).toBe("Original Title edited");
      }
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Issue actions" })
        ).toHaveFocus();
      });
    });

    it("ignores Cancel and Save while a save is in flight", async () => {
      const user = userEvent.setup();
      let settle: (value: {
        ok: true;
        value: { issueId: string };
      }) => void = () => undefined;
      updateIssueTitleSpy.mockImplementation(
        () =>
          new Promise((resolve) => {
            settle = resolve;
          })
      );
      render(
        <EditableIssueTitle issueId="issue-1" title="Original Title" canEdit />
      );
      const input = await openFromMenu(user);
      await user.type(input, " edited");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(screen.getByLabelText("Edit issue title")).toHaveAttribute(
          "aria-busy",
          "true"
        );
      });

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      // Still editing, with the typed value, and saved only once.
      expect(screen.getByLabelText("Edit issue title")).toHaveValue(
        "Original Title edited"
      );
      expect(updateIssueTitleSpy).toHaveBeenCalledTimes(1);

      settle({ ok: true, value: { issueId: "issue-1" } });
      await waitFor(() => {
        expect(
          screen.queryByLabelText("Edit issue title")
        ).not.toBeInTheDocument();
      });
    });
  });
});
