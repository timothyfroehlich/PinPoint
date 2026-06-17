import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { EditableCell } from "~/components/machines/settings/EditableCell";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";

describe("InlineEditableText (editing)", () => {
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

  it("Esc reverts the draft to the external value WITHOUT calling onValueChange", () => {
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
    fireEvent.keyDown(input, { key: "Escape" });

    // Draft snaps back to the external value; nothing is committed.
    expect(input).toHaveValue("Tournament");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("shows a required error on blur-while-blank and clears it on a non-blank commit", () => {
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

    // Clear and blur → the required error surfaces (the accessible name gains
    // "(required)" and aria-invalid is set); the blank value is NOT committed.
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

describe("EditableCell", () => {
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

  it("Enter commits the trimmed value via onCommit", () => {
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
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("DS-1");
    // Collapses back to the display button after a keyboard commit.
    expect(screen.getByRole("button", { name: "Row ID" })).toBeInTheDocument();
  });

  it("Esc reverts without committing", () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        value="original"
        canEdit
        onCommit={onCommit}
        autoFocusOnMount
        ariaLabel="Row ID"
      />
    );
    const input = screen.getByRole("textbox", { name: "Row ID" });
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    // Back in display mode showing the original value.
    expect(screen.getByRole("button", { name: "Row ID" })).toHaveTextContent(
      "original"
    );
  });
});
