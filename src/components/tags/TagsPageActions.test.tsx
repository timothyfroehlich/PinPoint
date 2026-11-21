import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagsPageActions } from "./TagsPageActions";

vi.mock("~/app/(app)/c/tags/actions", () => ({
  createTagAction: vi.fn(),
  createTagTypeAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function controls(): (string | null)[] {
  return [
    ...document.querySelectorAll(
      "[data-page-actions] > a, [data-page-actions] > button"
    ),
  ].map((element) => element.getAttribute("aria-label"));
}

/** The Tags page's actions (spec 11.12–11.14; design-bible §26). */
describe("TagsPageActions", () => {
  it("shows everyone the Settings tags link, outlined", () => {
    render(<TagsPageActions manage={null} />);
    expect(screen.getByRole("link", { name: "Settings tags" })).toHaveAttribute(
      "href",
      "/c/settings-tags"
    );
    expect(controls()).toEqual(["Settings tags"]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("gives technicians Add tag, filled, and Add tag type as ⋯'s lone entry shown as a button", () => {
    render(<TagsPageActions manage={{ types: [] }} />);
    expect(controls()).toEqual(["Settings tags", "Add tag", "Add tag type"]);
    expect(screen.getByRole("button", { name: "Add tag" })).toHaveClass(
      "bg-primary"
    );
    expect(
      screen.getByRole("button", { name: "Add tag type" })
    ).not.toHaveClass("bg-primary");
    expect(
      screen.queryByRole("button", { name: "More" })
    ).not.toBeInTheDocument();
  });

  it("opens Add tag and Add tag type, returning focus to the button that opened each", async () => {
    const user = userEvent.setup();
    render(
      <TagsPageActions manage={{ types: [{ id: "loc", name: "Location" }] }} />
    );
    const addTag = screen.getByRole("button", { name: "Add tag" });
    await user.click(addTag);
    expect(
      await screen.findByRole("dialog", { name: "Add tag" })
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(addTag).toHaveFocus();

    const addType = screen.getByRole("button", { name: "Add tag type" });
    await user.click(addType);
    expect(
      await screen.findByRole("dialog", { name: "Add tag type" })
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(addType).toHaveFocus();
  });
});
