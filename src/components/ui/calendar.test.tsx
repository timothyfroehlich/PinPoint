import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Calendar } from "~/components/ui/calendar";

describe("Calendar", () => {
  it("focuses the selected day when autofocus is enabled", () => {
    const selected = new Date(2026, 0, 15);

    render(
      <Calendar
        autoFocus
        defaultMonth={selected}
        mode="single"
        selected={selected}
      />
    );

    expect(
      screen.getByRole("button", { name: /January 15th, 2026, selected/i })
    ).toHaveFocus();
  });
});
