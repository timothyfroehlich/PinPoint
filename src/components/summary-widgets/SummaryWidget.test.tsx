import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
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

function widget({
  widgetSegments = segments,
  selectedValue = null,
  onSegmentSelect = vi.fn(),
}: {
  widgetSegments?: SummaryWidgetSegment<Value>[];
  selectedValue?: Value | null;
  onSegmentSelect?: (value: Value) => void;
} = {}): React.JSX.Element {
  return (
    <SummaryWidget
      id="test-widget"
      label="Status"
      segments={widgetSegments}
      selectedValue={selectedValue}
      onSegmentSelect={onSegmentSelect}
    />
  );
}

function renderWidget(options: Parameters<typeof widget>[0] = {}): {
  onSegmentSelect: ReturnType<typeof vi.fn>;
} {
  const onSegmentSelect = vi.fn();
  render(widget({ ...options, onSegmentSelect }));
  return { onSegmentSelect };
}

function withCounts(
  counts: [number, number, number]
): SummaryWidgetSegment<Value>[] {
  return segments.map((segment, i) => ({ ...segment, count: counts[i] ?? 0 }));
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

  it("lists nonzero Segments in the host's order and leaves zero ones out", () => {
    renderWidget();
    const region = screen.getByRole("region", { name: "Status" });

    expect(
      within(region)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["2 Worn", "4 Up"]);
    expect(
      screen.queryByRole("button", { name: "0 Down" })
    ).not.toBeInTheDocument();
  });

  it("rolls Segments that do not fit into N other, which still offers each one", async () => {
    stubBreakdownWidths();
    const user = userEvent.setup();
    const { onSegmentSelect } = renderWidget({
      widgetSegments: withCounts([1, 2, 4]),
    });
    const region = screen.getByRole("region", { name: "Status" });

    // "1 Down" fits beside "6 other"; Worn and Up roll up.
    expect(
      within(region).getByRole("button", { name: "1 Down" })
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

  it("names the rolled-up Segment that is the active filter on N other", () => {
    stubBreakdownWidths();
    renderWidget({
      widgetSegments: withCounts([1, 2, 4]),
      selectedValue: "up",
    });
    const region = screen.getByRole("region", { name: "Status" });

    expect(
      within(region).getByRole("button", { name: "6 other, Up selected" })
    ).toBeEnabled();
  });

  it("leaves zero-count Segments out of N other", async () => {
    stubBreakdownWidths();
    const user = userEvent.setup();
    renderWidget({ widgetSegments: withCounts([1, 0, 4]) });

    await user.click(screen.getByRole("button", { name: "4 other" }));
    const others = screen.getByRole("list", { name: "Other Status" });
    expect(
      within(others)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["4 Up"]);
  });

  it.each([
    { lineSwatches: "shown", hideRule: "", expected: true },
    {
      lineSwatches: "hidden",
      hideRule: "[data-swatch]{display:none}",
      expected: false,
    },
  ])(
    "shows swatches in N other only when the line shows them (widgets §5.7; line swatches $lineSwatches)",
    async ({ hideRule, expected }) => {
      stubBreakdownWidths();
      // The list renders in a portal, outside the group's container query,
      // so it copies what the line's swatches show when it opens. jsdom
      // applies no Tailwind CSS; this rule stands in for the stacked layout.
      const style = document.createElement("style");
      style.textContent = hideRule;
      document.head.append(style);
      const user = userEvent.setup();
      renderWidget({ widgetSegments: withCounts([1, 2, 4]) });

      await user.click(screen.getByRole("button", { name: "6 other" }));
      const swatch = within(screen.getByRole("list", { name: "Other Status" }))
        .getByRole("button", { name: "4 Up" })
        .querySelector("[data-swatch]");
      style.remove();
      if (expected) expect(swatch).toHaveClass("inline-block");
      else expect(swatch).not.toHaveClass("inline-block");
    }
  );

  it("server-renders whole pairs only, wrapping the ones that do not fit out of view until measured", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(widget());
    const pairs = within(container).getAllByRole("button");

    // No measurement yet: every pair, no "N other".
    expect(pairs.map((button) => button.getAttribute("aria-label"))).toEqual([
      "2 Worn",
      "4 Up",
    ]);
    // A one-entry-high wrapping line hides an overflowing pair whole rather
    // than clipping it mid-pair. jsdom has no layout, so the classes are
    // the observable contract here.
    const line = pairs[0]?.parentElement;
    expect(line).toHaveClass("flex-wrap", "max-h-8", "overflow-hidden");
  });

  it("stops wrapping once measured, so a shown entry is never hidden whole", () => {
    stubBreakdownWidths();
    renderWidget();
    const line = screen.getByRole("button", { name: "2 Worn" }).parentElement;

    expect(line).not.toHaveClass("flex-wrap");
    expect(line).toHaveClass("overflow-x-clip");
  });
});
