import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  IssueSectionPanel,
  IssueSectionTabList,
  IssueSections,
} from "~/components/issues/IssueSectionTabs";

/**
 * A link to a comment opens on the Issue tab (spec issue-detail §2.5, §11.2),
 * including one followed from another tab of the same page.
 */
function renderPage(): void {
  render(
    <IssueSections>
      <IssueSectionTabList otherIssuesCount={0} />
      <IssueSectionPanel section="issue">
        <article id="comment-c1" aria-label="A comment">
          Comment body
        </article>
      </IssueSectionPanel>
      <IssueSectionPanel section="details">
        {/* A Next <Link> handles its own click (pushState, no hashchange). */}
        <a href="#comment-c1" onClick={(event) => event.preventDefault()}>
          Jump to comment
        </a>
      </IssueSectionPanel>
    </IssueSections>
  );
}

describe("IssueSections comment links", () => {
  it("a same-page link to a comment switches to Issue and focuses the comment", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(screen.getByRole("link", { name: "Jump to comment" }));

    expect(screen.getByRole("tab", { name: "Issue" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await waitFor(() => {
      expect(screen.getByRole("article", { name: "A comment" })).toHaveFocus();
    });
  });

  it("a hash change to a comment switches to Issue", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /Other issues/ }));

    window.location.hash = "#comment-c1";
    fireEvent(window, new HashChangeEvent("hashchange"));

    expect(screen.getByRole("tab", { name: "Issue" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    window.location.hash = "";
  });
});
