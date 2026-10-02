/**
 * ExactRelativeTime: the exact time behind a relative one. The server-page
 * regression for zone-dependent SSR attributes lives in
 * issue-detail-permissions.test.tsx; this file covers the client side.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ExactRelativeTime } from "./ExactRelativeTime";
import { RelativeTimeProvider } from "./RelativeTimeProvider";
import { TooltipProvider } from "~/components/ui/tooltip";
import { formatDateTime } from "~/lib/dates";

const value = "2026-02-03T14:30:00.000Z";

function renderMounted(): HTMLElement {
  render(
    <RelativeTimeProvider>
      <TooltipProvider>
        <ExactRelativeTime
          value={value}
          // A server-built label in another zone than the viewer's.
          fallback="Feb 3, 2026, 2:30 PM UTC (server)"
          prefix="reported"
        />
      </TooltipProvider>
    </RelativeTimeProvider>
  );
  return screen.getByRole("button", { name: /^reported / });
}

describe("ExactRelativeTime", () => {
  it("formats the exact time in the viewer's zone once mounted, not the server's", () => {
    const trigger = renderMounted();

    // Prod once kept the server's (UTC) string after mount (~5h off).
    expect(trigger).toHaveAccessibleDescription(formatDateTime(value));
    // The visible relative text is the name; no aria-label replaces it.
    expect(trigger).not.toHaveAttribute("aria-label");
    expect(trigger.querySelector("time")).toHaveAttribute("datetime", value);
  });

  it("shows the exact time on tap, and a second tap hides it", () => {
    const trigger = renderMounted();

    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      formatDateTime(value)
    );

    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it.each(["{Enter}", " "])(
    "keeps the exact time showing when a keyboard user presses %s on the focused time",
    async (key) => {
      const user = userEvent.setup();
      const trigger = renderMounted();

      await user.tab();
      expect(trigger).toHaveFocus();
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        formatDateTime(value)
      );

      await user.keyboard(key);
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        formatDateTime(value)
      );

      // Escape is how the keyboard dismisses it.
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    }
  );
});
