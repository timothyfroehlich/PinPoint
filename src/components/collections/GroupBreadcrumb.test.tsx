import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TAG_TYPES } from "~/lib/tags/types";
import {
  COLLECTIONS_CRUMB,
  GroupBreadcrumb,
  tagCrumbs,
} from "./GroupBreadcrumb";

describe("GroupBreadcrumb (collections-and-tags 4.8, 7.7)", () => {
  it("links Tags and the tag type on a tag's page, separated by ›", () => {
    render(<GroupBreadcrumb crumbs={tagCrumbs(TAG_TYPES.manufacturer)} />);

    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute(
      "href",
      "/c/tags"
    );
    expect(screen.getByRole("link", { name: "Manufacturer" })).toHaveAttribute(
      "href",
      "/c/tags/manufacturer"
    );
    expect(trail).toHaveTextContent("Tags›Manufacturer");
  });

  it("links only Tags on a tag type's own page", () => {
    render(<GroupBreadcrumb crumbs={tagCrumbs()} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("links Collections to My Collections", () => {
    render(<GroupBreadcrumb crumbs={[COLLECTIONS_CRUMB]} />);
    expect(screen.getByRole("link", { name: "Collections" })).toHaveAttribute(
      "href",
      "/c/collections"
    );
  });

  it("ends with › only when it sits inline before the title", () => {
    const { rerender } = render(
      <GroupBreadcrumb crumbs={[COLLECTIONS_CRUMB]} />
    );
    expect(screen.getByRole("navigation")).toHaveTextContent(/^Collections$/);

    rerender(
      <GroupBreadcrumb
        crumbs={[COLLECTIONS_CRUMB]}
        trailingSeparatorClassName=""
      />
    );
    expect(screen.getByRole("navigation")).toHaveTextContent(/^Collections›$/);
  });
});
