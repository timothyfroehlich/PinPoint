import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { InlineMarkdownField } from "~/components/machines/settings/InlineMarkdownField";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";

/** A doc containing an autolinked URL — the shape that exposed the bug. */
const DOC_WITH_LINK: ProseMirrorDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "See " },
        {
          type: "text",
          text: "the manual",
          marks: [
            { type: "link", attrs: { href: "https://example.test/afm" } },
          ],
        },
      ],
    },
  ],
};

const DOC_PLAIN: ProseMirrorDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Tilt is hot." }] },
  ],
};

describe("InlineMarkdownField — clickToEdit at rest (PP-tn6t)", () => {
  // RichTextDisplay emits block content, and the editor runs `autolink: true`,
  // so any typed URL becomes an <a>. Wrapping that in a <button> is invalid
  // interactive nesting: the link can't be followed and headings/lists get
  // flattened into the button's accessible name. The at-rest state therefore
  // renders real markup beside a pencil button instead of inside one.
  it("never nests an anchor inside a button", () => {
    const { container } = render(
      <InlineMarkdownField
        value={DOC_WITH_LINK}
        canEdit
        clickToEdit
        onValueChange={vi.fn()}
      />
    );

    expect(container.querySelector("button a")).toBeNull();
  });

  it("keeps the link reachable at rest", () => {
    render(
      <InlineMarkdownField
        value={DOC_WITH_LINK}
        canEdit
        clickToEdit
        onValueChange={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: "the manual" });
    expect(link).toHaveAttribute("href", "https://example.test/afm");
  });

  it("does not swallow the body text into the pencil's accessible name", () => {
    render(
      <InlineMarkdownField
        value={DOC_PLAIN}
        canEdit
        clickToEdit
        label="notes"
        onValueChange={vi.fn()}
      />
    );

    const pencil = screen.getByRole("button", { name: "Edit notes" });
    expect(within(pencil).queryByText(/Tilt is hot/)).toBeNull();
  });

  it("opens the editor when the pencil is pressed", () => {
    render(
      <InlineMarkdownField
        value={DOC_PLAIN}
        canEdit
        clickToEdit
        onValueChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));
    // The pencil is replaced by the open editor.
    expect(
      screen.queryByRole("button", { name: "Edit description" })
    ).toBeNull();
  });

  describe("empty value", () => {
    // With nothing to render there is no anchor to worry about, so the whole
    // placeholder stays a single easy-to-hit button.
    it("renders the placeholder as one button and opens on click", () => {
      render(
        <InlineMarkdownField
          value={null}
          canEdit
          clickToEdit
          placeholder="Add a short description…"
          onValueChange={vi.fn()}
        />
      );

      const button = screen.getByRole("button", { name: "Edit description" });
      expect(button).toHaveTextContent("Add a short description…");

      fireEvent.click(button);
      expect(
        screen.queryByRole("button", { name: "Edit description" })
      ).toBeNull();
    });
  });

  describe("read-only viewers", () => {
    it("renders the text with no edit affordance", () => {
      render(
        <InlineMarkdownField
          value={DOC_WITH_LINK}
          canEdit={false}
          clickToEdit
          onValueChange={vi.fn()}
        />
      );

      expect(screen.getByRole("link", { name: "the manual" })).toBeVisible();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
