import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SummaryWidgetGroup } from "./SummaryWidgetGroup";

const KEY = "pinpoint:summary-widgets:test";

function group(): React.JSX.Element {
  return (
    <SummaryWidgetGroup storageKey={KEY} summaryRow="3 open" widgetCount={2}>
      <section aria-label="First widget" />
      <section aria-label="Second widget" />
    </SummaryWidgetGroup>
  );
}

function renderGroup(): void {
  render(group());
}

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
 * The phone section's open state (widgets §2.4, §2.6). jsdom applies no
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
