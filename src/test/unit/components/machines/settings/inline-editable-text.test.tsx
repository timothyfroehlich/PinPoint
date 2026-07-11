import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { EditableCell } from "~/components/machines/settings/EditableCell";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";

describe("InlineEditableText (always-live model, PP-43q3 pivot)", () => {
  it("renders the input with enterKeyHint='done'", () => {
    render(
      <InlineEditableText
        value="Tournament"
        onValueChange={vi.fn()}
        canEdit
        ariaLabel="set name"
      />
    );
    const input = screen.getByRole("textbox", { name: "set name" });
    expect(input).toHaveAttribute("enterkeyhint", "done");
  });

  it("typing pushes to working copy immediately via onValueChange", () => {
    const onValueChange = vi.fn();
    render(
      <InlineEditableText
        value="Tournament"
        onValueChange={onValueChange}
        canEdit
        ariaLabel="set name"
      />
    );
    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Casual" } });
    // The working copy is updated on every change — no explicit Save needed.
    expect(onValueChange).toHaveBeenCalledWith("Casual");
  });

  it("Esc reverts the draft display and restores the working copy", () => {
    const onValueChange = vi.fn();
    render(
      <InlineEditableText
        value="Tournament"
        onValueChange={onValueChange}
        canEdit
        ariaLabel="set name"
      />
    );
    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Casual" } });
    // onChange pushed "Casual" into the working copy.
    expect(onValueChange).toHaveBeenCalledWith("Casual");
    onValueChange.mockClear();

    fireEvent.keyDown(input, { key: "Escape" });
    // Draft snaps back to the external value in the input.
    expect(input).toHaveValue("Tournament");
    // Esc restores the working copy to the external value.
    expect(onValueChange).toHaveBeenCalledWith("Tournament");
  });

  it("shows a required error on blur-while-blank; blank is NOT propagated for required fields", () => {
    const onValueChange = vi.fn();
    render(
      <InlineEditableText
        value="Old name"
        onValueChange={onValueChange}
        canEdit
        required
        ariaLabel="set name"
      />
    );
    const input = screen.getByRole("textbox", { name: "set name" });

    // Clear and blur → the required error surfaces (accessible name gains
    // "(required)" and aria-invalid is set); the blank value is NOT committed
    // to the working copy because onChange skips propagating blank for required
    // fields.
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    const invalid = screen.getByRole("textbox", {
      name: "set name (required)",
    });
    expect(invalid).toHaveAttribute("aria-invalid", "true");
    expect(onValueChange).not.toHaveBeenCalled();

    // Type something real and commit → the error clears and the value commits.
    fireEvent.change(invalid, { target: { value: "Casual" } });
    fireEvent.blur(invalid);
    const cleared = screen.getByRole("textbox", { name: "set name" });
    expect(cleared).not.toHaveAttribute("aria-invalid");
    expect(onValueChange).toHaveBeenCalledWith("Casual");
  });

  it("an OPTIONAL field can be cleared to empty (propagates the clear)", () => {
    const onValueChange = vi.fn();
    render(
      <InlineEditableText
        value="Bank A"
        onValueChange={onValueChange}
        canEdit
        ariaLabel="bank name"
      />
    );
    const input = screen.getByRole("textbox", { name: /bank name/i });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input); // commit
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("a REQUIRED field shows the asterisk placeholder and is aria-required", () => {
    render(
      <InlineEditableText
        value=""
        onValueChange={vi.fn()}
        canEdit
        required
        placeholder="Name this set"
        ariaLabel="set name"
      />
    );
    const input = screen.getByRole("textbox", { name: /set name/i });
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAttribute("placeholder", "Name this set *");
  });

  it("renders finished, non-interactive text when canEdit is false", () => {
    render(
      <InlineEditableText
        value="Tournament"
        onValueChange={vi.fn()}
        canEdit={false}
        ariaLabel="set name"
      />
    );
    expect(
      screen.queryByRole("textbox", { name: "set name" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Tournament")).toBeInTheDocument();
  });
});

describe("EditableCell (always-live model, PP-43q3 pivot)", () => {
  it("codeLike=true: input opts out of autocorrect / autocapitalize / spellcheck", () => {
    render(
      <EditableCell
        value="A.1 01"
        canEdit
        onCommit={vi.fn()}
        codeLike
        autoFocusOnMount
        ariaLabel="Row ID"
      />
    );
    const input = screen.getByRole("textbox", { name: "Row ID" });
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("autocapitalize", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
    // Commit-on-Enter single cell still hints "done".
    expect(input).toHaveAttribute("enterkeyhint", "done");
  });

  it("codeLike=false (default): those attrs are absent / default", () => {
    render(
      <EditableCell
        value="Balls Per Game"
        canEdit
        onCommit={vi.fn()}
        autoFocusOnMount
        ariaLabel="Setting name"
      />
    );
    const input = screen.getByRole("textbox", { name: "Setting name" });
    expect(input).not.toHaveAttribute("autocorrect");
    expect(input).not.toHaveAttribute("autocapitalize");
    // React renders spellCheck only when explicitly set; default leaves it off
    // the DOM (browser default = on), so it must NOT equal "false" here.
    expect(input.getAttribute("spellcheck")).not.toBe("false");
  });

  it("typing pushes the trimmed value to the working copy via onCommit", () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        value=""
        canEdit
        onCommit={onCommit}
        autoFocusOnMount
        ariaLabel="Row ID"
      />
    );
    const input = screen.getByRole("textbox", { name: "Row ID" });
    fireEvent.change(input, { target: { value: "  DS-1  " } });
    // onChange fires onCommit with the trimmed value on every change.
    expect(onCommit).toHaveBeenCalledWith("DS-1");
    // The input stays always-live — no collapse to display button.
    expect(screen.getByRole("textbox", { name: "Row ID" })).toBeInTheDocument();
  });

  it("Enter commits and fires onCommitBlur", () => {
    const onCommit = vi.fn();
    const onCommitBlur = vi.fn();
    render(
      <EditableCell
        value=""
        canEdit
        onCommit={onCommit}
        onCommitBlur={onCommitBlur}
        autoFocusOnMount
        ariaLabel="Row ID"
      />
    );
    const input = screen.getByRole("textbox", { name: "Row ID" });
    fireEvent.change(input, { target: { value: "DS-1" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("DS-1");
    expect(onCommitBlur).toHaveBeenCalledTimes(1);
    // The input remains in the DOM (always-live).
    expect(screen.getByRole("textbox", { name: "Row ID" })).toBeInTheDocument();
  });

  it("read-only viewer sees a plain span, not an input", () => {
    render(
      <EditableCell
        value="original"
        canEdit={false}
        onCommit={vi.fn()}
        ariaLabel="Row ID"
      />
    );
    expect(
      screen.queryByRole("textbox", { name: "Row ID" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("original")).toBeInTheDocument();
  });
});
