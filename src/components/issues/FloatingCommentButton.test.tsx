import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FloatingCommentButton } from "./FloatingCommentButton";
import {
  IssueSectionTabList,
  IssueSections,
} from "~/components/issues/IssueSectionTabs";

// Stub AddCommentForm to avoid jsdom + ProseMirror fragility. Surface
// `issueId`, `userId` (whose draft it restores), and `quick` so a dropped prop
// fails the open test.
vi.mock("~/components/issues/AddCommentForm", () => ({
  AddCommentForm: vi.fn(
    ({
      issueId,
      userId,
      quick,
    }: {
      issueId: string;
      userId: string;
      quick?: boolean;
    }) => (
      <div
        data-testid="mock-add-comment-form"
        data-issue-id={issueId}
        data-user-id={userId}
        data-quick={String(quick)}
      />
    )
  ),
}));

function renderOnIssuePage(): void {
  render(
    <IssueSections>
      <IssueSectionTabList otherIssuesCount={0} />
      <FloatingCommentButton issueId="test-issue-123" userId="user-1" />
    </IssueSections>
  );
}

describe("FloatingCommentButton (spec issue-detail §8.3)", () => {
  it("is mobile-only: hidden from md: up, where the comment box is inline", () => {
    renderOnIssuePage();
    expect(
      screen.getByTestId("floating-comment-button").parentElement
    ).toHaveClass("md:hidden");
  });

  it("shows on the Issue tab only", () => {
    renderOnIssuePage();
    expect(screen.getByRole("button", { name: "Comment" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    expect(
      screen.queryByRole("button", { name: "Comment" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Other issues/ }));
    expect(
      screen.queryByRole("button", { name: "Comment" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Issue" }));
    expect(screen.getByRole("button", { name: "Comment" })).toBeInTheDocument();
  });

  it("opens the quick composer in a sheet for this issue", async () => {
    renderOnIssuePage();
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const form = screen.getByTestId("mock-add-comment-form");
    expect(form.getAttribute("data-issue-id")).toBe("test-issue-123");
    expect(form.getAttribute("data-user-id")).toBe("user-1");
    expect(form.getAttribute("data-quick")).toBe("true");
  });
});
