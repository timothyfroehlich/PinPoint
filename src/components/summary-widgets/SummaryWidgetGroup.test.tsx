import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SummaryWidget, type SummaryWidgetSegment } from "./SummaryWidget";
import {
  SummaryRowToggle,
  SummaryWidgetGroup,
  useSummaryWidgetsController,
} from "./SummaryWidgetGroup";

const KEY = "pinpoint:summary-widgets:test";

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

function group(widgetCount: 2 | 3 = 2): React.JSX.Element {
  return (
    <SummaryWidgetGroup
      storageKey={KEY}
      summaryRow="3 open"
      widgetCount={widgetCount}
    >
      {Array.from({ length: widgetCount }, (_, i) => widget(i + 1))}
    </SummaryWidgetGroup>
  );
}

function renderGroup(widgetCount: 2 | 3 = 2): void {
  render(group(widgetCount));
}

function toggleButton(): HTMLElement {
  return screen.getByRole("button", { name: "Summary: 3 open" });
}

/** The section the Summary Row toggle controls. */
function content(): HTMLElement {
  const id = toggleButton().getAttribute("aria-controls") ?? "";
  const element = document.getElementById(id);
  if (!element) throw new Error(`no element #${id}`);
  return element;
}

/**
 * The container query under which a host's widgets fit side by side: md+
 * and about 20rem of group width per widget (widgets §2.3).
 */
const SIDE_BY_SIDE = [
  { widgetCount: 2, sideBySide: "md:@min-[40rem]" },
  { widgetCount: 3, sideBySide: "md:@min-[60rem]" },
] as const;

/** Server-renders the group, then hydrates it in place like the browser. */
function hydrateGroup(): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToString(group());
  document.body.append(container);
  act(() => {
    hydrateRoot(container, group());
  });
  return container;
}

/**
 * The stacked section's open state (widgets §2.4, §2.6). jsdom applies no
 * Tailwind CSS, so the CSS default reads as open; a remembered choice
 * overrides it and is written back per host.
 */
describe("SummaryWidgetGroup", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("restores a remembered collapsed choice and remembers the next one", async () => {
    window.localStorage.setItem(KEY, "collapsed");
    const user = userEvent.setup();
    renderGroup();
    const toggle = screen.getByRole("button", { name: "Summary: 3 open" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(window.localStorage.getItem(KEY)).toBe("expanded");
  });

  it("follows the CSS default until the person chooses", async () => {
    const user = userEvent.setup();
    renderGroup();
    const toggle = screen.getByRole("button", { name: "Summary: 3 open" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(window.localStorage.getItem(KEY)).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem(KEY)).toBe("collapsed");
  });

  it("server-renders no expanded state, since only the browser knows the screen width", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(group());

    expect(
      within(container).getByRole("button", { name: "Summary: 3 open" })
    ).not.toHaveAttribute("aria-expanded");
  });

  it.each([
    { stored: null, expected: "true" },
    { stored: "collapsed", expected: "false" },
  ])(
    "hydrates without a mismatch and then states the open state (remembered: $stored)",
    ({ stored, expected }) => {
      if (stored !== null) window.localStorage.setItem(KEY, stored);
      const consoleError = vi.spyOn(console, "error");

      const container = hydrateGroup();

      expect(
        within(container).getByRole("button", { name: "Summary: 3 open" })
      ).toHaveAttribute("aria-expanded", expected);
      expect(consoleError).not.toHaveBeenCalled();
    }
  );
});

/**
 * Stacked versus side by side (widgets §2.3, §2.4, §5.7). jsdom has no
 * layout, so the CSS classes that switch at the side-by-side container query
 * are the observable contract; the base classes are the stacked layout, at
 * every width.
 */
describe.each(SIDE_BY_SIDE)(
  "SummaryWidgetGroup with $widgetCount widgets",
  ({ widgetCount, sideBySide }) => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("offers the collapse control whenever the widgets stack, wide layouts included", () => {
      renderGroup(widgetCount);

      expect(toggleButton()).toHaveClass("flex", `${sideBySide}:hidden`);
      expect(toggleButton()).not.toHaveClass("md:hidden");
      // The CSS default: open from 390px, then always shown side by side.
      expect(content()).toHaveClass(
        "hidden",
        "min-[390px]:grid",
        `${sideBySide}:grid`
      );
      expect(content()).not.toHaveClass("md:grid");
    });

    it("shows side-by-side widgets even when the person collapsed the stacked section", () => {
      window.localStorage.setItem(KEY, "collapsed");
      renderGroup(widgetCount);

      expect(toggleButton()).toHaveAttribute("aria-expanded", "false");
      expect(content()).toHaveClass("hidden", `${sideBySide}:grid`);
    });

    it("keeps the breakdown on the label line and the bar beneath it, stacked or side by side", () => {
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

    it("drops the swatches and the card whenever the widgets stack (§5.7)", () => {
      renderGroup(widgetCount);
      const region = screen.getByRole("region", { name: "Widget 1" });
      const swatch = within(region)
        .getByRole("button", { name: "1 Down" })
        .querySelector("[data-swatch]");

      // Hidden by default, shown only at the side-by-side query.
      expect(swatch).toHaveClass("hidden", `${sideBySide}:inline-block`);
      expect(swatch).not.toHaveClass("md:inline-block");
      // The card's padding, border, and rules apply only side by side.
      expect(region).toHaveClass("py-1.5", `${sideBySide}:px-4`);
      expect(region).not.toHaveClass("md:px-4");
      expect(content().parentElement).toHaveClass(`${sideBySide}:border`);
      expect(content().parentElement).not.toHaveClass("md:border");
      expect(content()).not.toHaveClass("divide-y", "md:divide-y");
    });

    it("hands the collapse control to a title-row toggle at every stacked width (list-views §8.4)", async () => {
      const user = userEvent.setup();
      function Host(): React.JSX.Element {
        const controller = useSummaryWidgetsController(KEY, widgetCount);
        return (
          <>
            <SummaryRowToggle controller={controller}>3 open</SummaryRowToggle>
            <SummaryWidgetGroup
              storageKey={KEY}
              summaryRow="3 open"
              widgetCount={widgetCount}
              controller={controller}
            >
              {Array.from({ length: widgetCount }, (_, i) => widget(i + 1))}
            </SummaryWidgetGroup>
          </>
        );
      }
      render(<Host />);

      // Exactly one toggle: shown whenever the widgets stack, hidden side
      // by side, never limited to phones.
      const toggle = toggleButton();
      expect(
        screen.getAllByRole("button", { name: "Summary: 3 open" })
      ).toHaveLength(1);
      expect(toggle).toHaveClass(`${sideBySide}:hidden`);
      expect(toggle).not.toHaveClass("md:hidden");
      // Without its own toggle, the stacked section has no rule beneath it.
      expect(content().parentElement).not.toHaveClass("border-b");
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(content()).toHaveClass("hidden", `${sideBySide}:grid`);
    });
  }
);
