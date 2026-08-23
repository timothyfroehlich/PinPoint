import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  RouteTabStrip,
  type RouteTab,
} from "~/components/layout/RouteTabStrip";

const pathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));

const tabs: readonly RouteTab[] = [
  { slug: "", label: "Info" },
  { slug: "settings", label: "Settings" },
  {
    slug: "maintenance",
    label: "Service",
    badge: { count: 12, status: "needs_service" },
  },
  { slug: "timeline", label: "Timeline" },
  { slug: "edit", label: "Manage" },
];

describe("RouteTabStrip", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/m/TAF");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders all routes directly when they fit", async () => {
    mockElementWidths({
      container: 500,
      tabs: [60, 80, 100, 80, 80],
      trigger: 48,
    });

    renderStrip();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /More machine sections/ })
      ).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Info" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("moves omitted routes into an accessible menu as real anchors", async () => {
    mockElementWidths({
      container: 230,
      tabs: [60, 80, 100, 80, 80],
      trigger: 48,
    });
    const user = userEvent.setup();

    renderStrip();
    const trigger = await screen.findByRole("button", {
      name: "More machine sections",
    });
    expect(trigger.tagName).toBe("BUTTON");

    await user.click(trigger);
    const menu = await screen.findByRole("menu");
    const service = within(menu).getByRole("menuitem", { name: /Service/ });
    const timeline = within(menu).getByRole("menuitem", { name: "Timeline" });
    const manage = within(menu).getByRole("menuitem", { name: "Manage" });

    expect(service.tagName).toBe("A");
    expect(timeline.tagName).toBe("A");
    expect(manage.tagName).toBe("A");
    expect(service).toHaveAttribute("href", "/m/TAF/maintenance");
    expect(timeline).toHaveAttribute("href", "/m/TAF/timeline");
    expect(manage).toHaveAttribute("href", "/m/TAF/edit");
  });

  it("does not reopen the menu after overflow disappears and returns", async () => {
    const setContainerWidth = mockElementWidths({
      container: 230,
      tabs: [60, 80, 100, 80, 80],
      trigger: 48,
    });
    const user = userEvent.setup();

    const { rerender } = renderStrip();
    await user.click(
      await screen.findByRole("button", { name: "More machine sections" })
    );
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    setContainerWidth(500);
    rerender(strip([...tabs]));
    await waitFor(() => {
      expect(screen.queryByTestId("machine-tab-more")).not.toBeInTheDocument();
    });

    setContainerWidth(230);
    rerender(strip([...tabs]));
    await screen.findByRole("button", { name: "More machine sections" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("announces the current route when the trigger overlaps its label", async () => {
    pathnameMock.mockReturnValue("/m/TAF/edit");
    mockElementWidths({
      container: 110,
      tabs: [60, 80, 100, 80, 100],
      trigger: 48,
    });
    const user = userEvent.setup();

    renderStrip();

    const trigger = await screen.findByRole("button", {
      name: "More machine sections, current section: Manage",
    });
    expect(screen.getByTestId("machine-tab-edit")).toHaveAttribute(
      "aria-current",
      "page"
    );

    await user.click(trigger);
    const menu = await screen.findByRole("menu");
    const currentLink = within(menu).getByRole("menuitem", { name: "Manage" });
    expect(currentLink.tagName).toBe("A");
    expect(currentLink).toHaveAttribute("aria-current", "page");
    expect(currentLink).toHaveAttribute("href", "/m/TAF/edit");
  });
});

function renderStrip() {
  return render(strip(tabs));
}

function strip(tabsToRender: readonly RouteTab[]) {
  return (
    <RouteTabStrip
      basePath="/m/TAF"
      tabs={tabsToRender}
      ariaLabel="Machine sections"
      testIdPrefix="machine-tab"
    />
  );
}

function mockElementWidths({
  container,
  tabs: tabWidths,
  trigger,
}: {
  container: number;
  tabs: readonly number[];
  trigger: number;
}): (width: number) => void {
  let containerWidth = container;
  let measuredTabIndex = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement): DOMRect {
      if (this.dataset.testid === "machine-tab-strip") {
        return DOMRect.fromRect({ width: containerWidth });
      }
      if (this.hasAttribute("data-overflow-trigger-measure")) {
        return DOMRect.fromRect({ width: trigger });
      }
      if (this.hasAttribute("data-tab-measure")) {
        const width = tabWidths[measuredTabIndex] ?? 0;
        measuredTabIndex = (measuredTabIndex + 1) % tabWidths.length;
        return DOMRect.fromRect({ width });
      }
      return DOMRect.fromRect();
    }
  );
  return (width: number): void => {
    containerWidth = width;
  };
}
