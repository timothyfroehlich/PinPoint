import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { StickyCommentComposer } from "./StickyCommentComposer";

// Mock AddCommentForm dependencies so jsdom can render without server actions
vi.mock("~/app/(app)/issues/actions", () => ({
  addCommentAction: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: vi.fn().mockReturnValue([undefined, vi.fn(), false]),
  };
});

describe("StickyCommentComposer", () => {
  it("renders the trigger as a fixed-position bar", () => {
    render(<StickyCommentComposer issueId="issue-1" />);
    const trigger = screen.getByRole("button", { name: /add a comment/i });
    expect(trigger).toBeInTheDocument();
  });

  it("the wrapper is hidden at md: viewport (md:hidden)", () => {
    const { container } = render(<StickyCommentComposer issueId="issue-1" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("md:hidden");
  });

  it("the wrapper is fixed to the bottom of the viewport above the BottomTabBar", () => {
    const { container } = render(<StickyCommentComposer issueId="issue-1" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("fixed");
    expect(wrapper.className).toMatch(
      /bottom-\[calc\(56px\+env\(safe-area-inset-bottom\)\)\]/
    );
  });

  it("opens a Sheet when the trigger is clicked", async () => {
    render(<StickyCommentComposer issueId="issue-1" />);
    const trigger = screen.getByRole("button", { name: /add a comment/i });
    fireEvent.click(trigger);
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toBeInTheDocument();
  });
});
