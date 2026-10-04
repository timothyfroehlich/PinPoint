import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListPager } from "./ListPager";

describe("ListPager", () => {
  it("shows the result range alone when the list has one page (list-views §8.3)", () => {
    const { container } = render(
      <ListPager
        pagination={{ page: 1, pageSize: 25, totalCount: 12, onPage: vi.fn() }}
      />
    );

    expect(container).toHaveTextContent("1–12 of 12");
    expect(
      screen.queryByRole("navigation", { name: "Pagination" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
