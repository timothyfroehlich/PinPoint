import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TagTrail } from "./TagTrail";
import { MANUFACTURER_TAG_TYPE } from "~/lib/tags/types";

describe("TagTrail", () => {
  it("links Tags and the tag type on a tag's page", () => {
    render(<TagTrail type={MANUFACTURER_TAG_TYPE} />);
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(trail).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute(
      "href",
      "/c/tags"
    );
    expect(screen.getByRole("link", { name: "Manufacturer" })).toHaveAttribute(
      "href",
      "/c/tags/manufacturer"
    );
  });

  it("links only Tags on a tag type's own page", () => {
    render(<TagTrail />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
