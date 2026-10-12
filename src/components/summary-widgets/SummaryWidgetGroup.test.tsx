import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SUMMARY_WIDGET_GAP_PX, summaryRowMinWidth } from "./layout";
import { SummaryWidget, type SummaryWidgetSegment } from "./SummaryWidget";
import { SummaryWidgetGroup } from "./SummaryWidgetGroup";

const SEGMENTS: SummaryWidgetSegment<"down" | "up">[] = [
  {
    value: "down",
    label: "Down",
    count: 1,
    textClassName: "text-destructive-text",
    fillClassName: "bg-destructive",
  },
  {
    value: "up",
    label: "Up",
    count: 2,
    textClassName: "text-success",
    fillClassName: "bg-success",
  },
];

function widget(index: number): React.JSX.Element {
  return (
    <SummaryWidget
      key={index}
      id={`widget-${index}`}
      label={`Widget ${index}`}
      segments={SEGMENTS}
      selectedValue={null}
      onSegmentSelect={vi.fn()}
    />
  );
}

function renderGroup(widgetCount: 2 | 3): void {
  render(
    <SummaryWidgetGroup>
      {Array.from({ length: widgetCount }, (_, i) => widget(i + 1))}
    </SummaryWidgetGroup>
  );
}

/** The slot a widget sits in: the element its container query shows. */
function slotOf(index: number): HTMLElement {
  const slot = screen.getByRole("region", {
    name: `Widget ${index}`,
  }).parentElement;
  if (!slot) throw new Error(`no slot for Widget ${index}`);
  return slot;
}

/**
 * jsdom has no layout and applies no Tailwind CSS, so the container-query
 * classes are the observable contract for which widgets show at a width.
 */
describe.each([2, 3] as const)(
  "SummaryWidgetGroup with %i widgets",
  (widgetCount) => {
    it("shows every widget in the host's order, always expanded, with no collapse control (widgets §2.3)", () => {
      renderGroup(widgetCount);

      expect(
        screen.getAllByRole("region").map((region) => region.textContent)
      ).toEqual(
        Array.from({ length: widgetCount }, (_, i) =>
          expect.stringContaining(`Widget ${i + 1}`)
        )
      );
      expect(screen.queryByRole("button", { name: /^Summary/ })).toBeNull();
      expect(
        document.querySelector("[aria-expanded], [aria-controls]")
      ).toBeNull();
    });

    it("drops whole widgets from the right as the row narrows, never below 240px each (widgets §2.7)", () => {
      renderGroup(widgetCount);

      expect(slotOf(1)).toHaveClass("hidden", "@min-[240px]:block", "basis-60");
      for (let i = 2; i <= widgetCount; i += 1) {
        // Widget i shows only while the row holds i widgets at 240px plus
        // the gaps between them, so the last widget drops first. The gap,
        // and so the threshold, is narrower on phones.
        expect(slotOf(i)).toHaveClass(
          "hidden",
          `max-md:@min-[${summaryRowMinWidth(i, SUMMARY_WIDGET_GAP_PX.phone)}px]:block`,
          `md:@min-[${summaryRowMinWidth(i, SUMMARY_WIDGET_GAP_PX.desktop)}px]:block`,
          "basis-60"
        );
      }
      expect(slotOf(1).parentElement).toHaveClass("gap-4", "md:gap-6");
      // Every slot measures the same row container.
      const row = slotOf(1).parentElement;
      expect(row?.parentElement).toHaveClass("@container");
      for (let i = 2; i <= widgetCount; i += 1) {
        expect(slotOf(i).parentElement).toBe(row);
      }
    });

    it("is not shown when not even one widget fits (widgets §2.7)", () => {
      renderGroup(widgetCount);
      const card = slotOf(1).closest(".md\\:border");

      expect(card).toHaveClass("hidden", "@min-[240px]:block");
      expect(card?.parentElement).toHaveClass("@container");
    });

    it("keeps the breakdown on the label line and the bar beneath it (widgets §5.7)", () => {
      renderGroup(widgetCount);

      for (let i = 1; i <= widgetCount; i += 1) {
        const region = screen.getByRole("region", { name: `Widget ${i}` });
        const breakdown = within(region).getByRole("button", {
          name: "1 Down",
        }).parentElement;
        const [label, bar] = Array.from(region.children);

        // DOM order stays label, bar, breakdown for screen readers.
        expect(Array.from(region.children)).toEqual([label, bar, breakdown]);
        expect(bar).toHaveAttribute("aria-hidden", "true");
        // Flex order puts the breakdown on the label line, the bar beneath.
        expect(breakdown).toHaveClass("order-2");
        expect(bar).toHaveClass("order-4");
      }
    });
  }
);

describe("summaryRowMinWidth", () => {
  it("is 240px per widget plus a 16px gap between neighbors on phones", () => {
    expect(
      [1, 2, 3].map((n) => summaryRowMinWidth(n, SUMMARY_WIDGET_GAP_PX.phone))
    ).toEqual([240, 496, 752]);
  });

  it("is 240px per widget plus a 24px gap between neighbors at md+", () => {
    expect(
      [1, 2, 3].map((n) => summaryRowMinWidth(n, SUMMARY_WIDGET_GAP_PX.desktop))
    ).toEqual([240, 504, 768]);
  });
});
