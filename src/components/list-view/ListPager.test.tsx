import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListPager, PhonePager } from "./ListPager";

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

  it("shows the result range beside the page controls when there are more pages (list-views §6.1, §8.3)", () => {
    const { container } = render(
      <ListPager
        pagination={{ page: 2, pageSize: 25, totalCount: 60, onPage: vi.fn() }}
      />
    );

    expect(container).toHaveTextContent("26–50 of 60");
    const pager = screen.getByRole("navigation", { name: "Pagination" });
    expect(
      within(pager).getByRole("button", { name: "Page 2" })
    ).toHaveAttribute("aria-current", "page");
  });
});

describe("PhonePager", () => {
  it("renders in place after the list with Previous, the range, and Next (list-views §7.8)", () => {
    const onPage = vi.fn();
    const { container } = render(
      <div data-testid="host">
        <PhonePager
          pagination={{ page: 2, pageSize: 25, totalCount: 84, onPage }}
        />
      </div>
    );

    const nav = within(screen.getByTestId("host")).getByRole("navigation", {
      name: "Pagination",
    });
    expect(nav).toHaveTextContent("26–50 of 84");
    within(nav).getByRole("button", { name: "Next page" }).click();
    expect(onPage).toHaveBeenCalledWith(3, true);
    expect(container.firstElementChild).toContainElement(nav);
  });

  it("shows the range alone when the list has one page (list-views §8.3)", () => {
    render(
      <PhonePager
        pagination={{ page: 1, pageSize: 25, totalCount: 9, onPage: vi.fn() }}
      />
    );

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toHaveTextContent("1–9 of 9");
    expect(within(nav).queryByRole("button")).not.toBeInTheDocument();
  });
});
