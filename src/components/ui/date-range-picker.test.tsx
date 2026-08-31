import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateRangePicker } from "~/components/ui/date-range-picker";

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("DateRangePicker", () => {
  it("labels and synchronizes the native date fields", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DateRangePicker
        label="Created"
        from={localDate(2026, 1, 15)}
        to={localDate(2026, 1, 31)}
        onChange={onChange}
        data-testid="created-range"
      />
    );

    const group = screen.getByRole("group", { name: "Created" });
    expect(within(group).getByLabelText("Created From")).toHaveValue(
      "2026-01-15"
    );
    expect(within(group).getByLabelText("Created To")).toHaveValue(
      "2026-01-31"
    );
    expect(screen.getByTestId("created-range-trigger")).toHaveAccessibleName(
      "Created date range: Jan 15, 2026 - Jan 31, 2026"
    );

    rerender(
      <DateRangePicker
        label="Created"
        from={localDate(2026, 2, 1)}
        onChange={onChange}
        data-testid="created-range"
      />
    );

    expect(within(group).getByLabelText("Created From")).toHaveValue(
      "2026-02-01"
    );
    expect(within(group).getByLabelText("Created To")).toHaveValue("");
  });

  it("keeps the edited from date and clears a crossed to date", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        label="Created"
        from={localDate(2026, 1, 1)}
        to={localDate(2026, 1, 15)}
        onChange={onChange}
        data-testid="created-range"
      />
    );

    fireEvent.change(screen.getByTestId("created-range-from"), {
      target: { value: "2026-01-20" },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      from: localDate(2026, 1, 20),
    });
    expect(screen.getByTestId("created-range-to")).toHaveValue("");
  });

  it("keeps the edited to date and clears a crossed from date", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        label="Modified"
        from={localDate(2026, 1, 15)}
        to={localDate(2026, 1, 31)}
        onChange={onChange}
        data-testid="modified-range"
      />
    );

    fireEvent.change(screen.getByTestId("modified-range-to"), {
      target: { value: "2026-01-10" },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      to: localDate(2026, 1, 10),
    });
    expect(screen.getByTestId("modified-range-from")).toHaveValue("");
  });

  it("clears one endpoint without clearing the other", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        label="Created"
        from={localDate(2026, 1, 1)}
        to={localDate(2026, 1, 31)}
        onChange={onChange}
        data-testid="created-range"
      />
    );

    fireEvent.change(screen.getByTestId("created-range-from"), {
      target: { value: "" },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      to: localDate(2026, 1, 31),
    });
    expect(screen.getByTestId("created-range-to")).toHaveValue("2026-01-31");
  });

  it("clears the whole range from the mobile action", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        label="Created"
        from={localDate(2026, 1, 1)}
        to={localDate(2026, 1, 31)}
        onChange={onChange}
        data-testid="created-range"
      />
    );

    fireEvent.click(screen.getByTestId("created-range-mobile-clear"));

    expect(onChange).toHaveBeenLastCalledWith({});
    expect(screen.getByTestId("created-range-from")).toHaveValue("");
    expect(screen.getByTestId("created-range-to")).toHaveValue("");
  });
});
