import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { SummaryWidgetGroup } from "./SummaryWidgetGroup";

const KEY = "pinpoint:summary-widgets:test";

function renderGroup(): void {
  render(
    <SummaryWidgetGroup storageKey={KEY} summaryRow="3 open" widgetCount={2}>
      <section aria-label="First widget" />
      <section aria-label="Second widget" />
    </SummaryWidgetGroup>
  );
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
});
