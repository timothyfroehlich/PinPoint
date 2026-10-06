import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClampedDescription } from "./ClampedDescription";

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// jsdom does no layout, so scrollHeight and clientHeight are both 0. Stand in
// for the browser: a clamped description reports more content than it shows.
function mockLayout(scrollHeight: number, clientHeight: number): void {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
    scrollHeight
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    clientHeight
  );
}

describe("ClampedDescription", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows no toggle when the text fits in three lines", () => {
    mockLayout(60, 60);
    render(<ClampedDescription>Short description.</ClampedDescription>);

    expect(screen.getByText("Short description.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("toggles between Show more and Show less when the text overflows", async () => {
    mockLayout(200, 60);
    render(<ClampedDescription>A long description.</ClampedDescription>);

    const more = screen.getByRole("button", { name: "Show more" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    const region = document.getElementById(
      more.getAttribute("aria-controls") ?? ""
    );
    expect(region).toHaveTextContent("A long description.");

    await userEvent.click(more);
    const less = screen.getByRole("button", { name: "Show less" });
    expect(less).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(less);
    expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});
