import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StickyCommentComposer } from "./StickyCommentComposer";

// Stub AddCommentForm to avoid jsdom + ProseMirror fragility
// (matches pattern in src/test/unit/components/issues/issue-detail-permissions.test.tsx)
vi.mock("~/components/issues/AddCommentForm", () => ({
  AddCommentForm: () => <div data-testid="mock-add-comment-form" />,
}));

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
