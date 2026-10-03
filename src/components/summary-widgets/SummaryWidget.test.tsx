import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SummaryWidget, type SummaryWidgetSegment } from "./SummaryWidget";

type Value = "down" | "worn" | "up";

const segments: SummaryWidgetSegment<Value>[] = [
  {
    value: "down",
    label: "Down",
    count: 0,
    textClassName: "text-destructive-text",
    fillClassName: "bg-destructive",
  },
  {
    value: "worn",
    label: "Worn",
    count: 2,
    textClassName: "text-warning",
    fillClassName: "bg-warning",
  },
  {
    value: "up",
    label: "Up",
    count: 4,
    textClassName: "text-success",
    fillClassName: "bg-success",
  },
];

function renderWidget(): { onSegmentSelect: ReturnType<typeof vi.fn> } {
  const onSegmentSelect = vi.fn();
  render(
    <SummaryWidget
      id="test-widget"
      label="Status"
      headline={{ figure: 4, text: "up", accentClassName: "text-success" }}
      segments={segments}
      selectedValue={null}
      onSegmentSelect={onSegmentSelect}
    />
  );
  return { onSegmentSelect };
}

/**
 * jsdom has no layout, so every width reads 0 and every pair fits. These
 * widths make the breakdown line hold one 60px pair beside a 30px "N other".
 */
function stubBreakdownWidths(): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      let width = 100; // the breakdown line itself
      if (this.hasAttribute("data-measure-segment")) width = 60;
      if (this.hasAttribute("data-measure-other")) width = 30;
      return new DOMRect(0, 0, width, 20);
    }
  );
}

describe("SummaryWidget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects a Segment by its value", async () => {
    const user = userEvent.setup();
    const { onSegmentSelect } = renderWidget();

    await user.click(screen.getByRole("button", { name: "4 Up" }));

    expect(onSegmentSelect).toHaveBeenCalledWith("up");
  });

  it("lists every Segment in the host's order, keeping a zero one unselectable", () => {
    renderWidget();
    const region = screen.getByRole("region", { name: "Status" });

    expect(
      within(region)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["0 Down", "2 Worn", "4 Up"]);
    expect(screen.getByRole("button", { name: "0 Down" })).toBeDisabled();
  });

  it("rolls Segments that do not fit into N other, which still offers each one", async () => {
    stubBreakdownWidths();
    const user = userEvent.setup();
    const { onSegmentSelect } = renderWidget();
    const region = screen.getByRole("region", { name: "Status" });

    // "0 Down" fits beside "6 other"; Worn and Up roll up.
    expect(
      within(region).getByRole("button", { name: "0 Down" })
    ).toBeInTheDocument();
    expect(
      within(region).queryByRole("button", { name: "4 Up" })
    ).not.toBeInTheDocument();

    await user.click(within(region).getByRole("button", { name: "6 other" }));
    const others = screen.getByRole("list", { name: "Other Status" });
    expect(
      within(others)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["2 Worn", "4 Up"]);

    await user.click(within(others).getByRole("button", { name: "4 Up" }));
    expect(onSegmentSelect).toHaveBeenCalledWith("up");
    expect(
      screen.queryByRole("list", { name: "Other Status" })
    ).not.toBeInTheDocument();
  });
});
