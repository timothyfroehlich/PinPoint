import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FloatingCommentButton } from "./FloatingCommentButton";

// Stub AddCommentForm to avoid jsdom + ProseMirror fragility. Surface
// `issueId` so a dropped or empty prop fails the open test.
vi.mock("~/components/issues/AddCommentForm", () => ({
  AddCommentForm: vi.fn(({ issueId }: { issueId: string }) => (
    <div data-testid="mock-add-comment-form" data-issue-id={issueId} />
  )),
}));

describe("FloatingCommentButton (spec issue-detail §8.3)", () => {
  it("is mobile-only: hidden from md: up, where the comment box is inline", () => {
    const { container } = render(<FloatingCommentButton issueId="issue-1" />);
    expect(container.firstChild).toHaveClass("md:hidden");
  });

  it("opens the composer in a sheet for this issue", async () => {
    render(<FloatingCommentButton issueId="test-issue-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByTestId("mock-add-comment-form").getAttribute("data-issue-id")
    ).toBe("test-issue-123");
  });
});
