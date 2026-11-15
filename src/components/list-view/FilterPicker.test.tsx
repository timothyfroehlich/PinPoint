import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterPicker } from "./FilterPicker";
import {
  filterSelectionText,
  type ListDateRangeFilterModel,
  type ListOptionsFilterModel,
} from "./types";

function optionsFilter(
  overrides: Partial<ListOptionsFilterModel> = {}
): ListOptionsFilterModel {
  return {
    id: "status",
    label: "Status",
    options: [
      { value: "new", label: "New", group: "Open" },
      { value: "confirmed", label: "Confirmed", group: "Open" },
      { value: "fixed", label: "Fixed", group: "Closed" },
    ],
    selected: [],
    valueLabel: null,
    atPreset: true,
    onChange: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
}

describe("FilterPicker option groups (list-views §4.4)", () => {
  it("selects a whole group from its heading", async () => {
    const filter = optionsFilter({ selected: ["fixed"] });
    render(<FilterPicker filter={filter} variant="popover" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Open, all" }));
    expect(filter.onChange).toHaveBeenCalledWith(["fixed", "new", "confirmed"]);
  });

  it("clears a fully selected group, and marks a partly selected one mixed", async () => {
    const full = optionsFilter({ selected: ["new", "confirmed", "fixed"] });
    const { unmount } = render(<FilterPicker filter={full} variant="sheet" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Open, all" }));
    expect(full.onChange).toHaveBeenCalledWith(["fixed"]);
    unmount();

    render(
      <FilterPicker
        filter={optionsFilter({ selected: ["new"] })}
        variant="popover"
      />
    );
    expect(screen.getByRole("checkbox", { name: "Open, all" })).toHaveAttribute(
      "data-state",
      "indeterminate"
    );
  });
});

describe("FilterPicker shortcuts that stand for several values", () => {
  it("adds every value and shows checked only when all are selected", async () => {
    const filter = optionsFilter({
      id: "machine",
      label: "Machine",
      options: [
        { value: "AFM", label: "Attack from Mars" },
        { value: "TZ", label: "Twilight Zone" },
      ],
      shortcuts: [
        { value: "my-machines", label: "My machines", values: ["AFM", "TZ"] },
      ],
      selected: ["AFM"],
    });
    render(<FilterPicker filter={filter} variant="popover" />);
    const shortcut = screen.getByRole("checkbox", { name: "My machines" });
    expect(shortcut).toHaveAttribute("data-state", "indeterminate");
    await userEvent.click(shortcut);
    expect(filter.onChange).toHaveBeenCalledWith(["AFM", "TZ"]);
  });
});

describe("FilterPicker date ranges", () => {
  function rangeFilter(
    overrides: Partial<ListDateRangeFilterModel> = {}
  ): ListDateRangeFilterModel {
    return {
      kind: "dateRange",
      id: "created",
      label: "Created",
      range: { from: null, to: null },
      valueLabel: null,
      atPreset: true,
      onRangeChange: vi.fn(),
      onReset: vi.fn(),
      ...overrides,
    };
  }

  it("sets either end and clears one by emptying it", () => {
    const filter = rangeFilter({ range: { from: "2026-09-01", to: null } });
    render(<FilterPicker filter={filter} variant="popover" />);
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-09-30" },
    });
    expect(filter.onRangeChange).toHaveBeenCalledWith({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(filter.onRangeChange).toHaveBeenLastCalledWith({
      from: null,
      to: null,
    });
  });

  it("applies an end only once its year is complete, keeping what is typed", () => {
    const filter = rangeFilter();
    render(<FilterPicker filter={filter} variant="popover" />);
    const to = screen.getByLabelText("To");
    // A date input reports the year digit by digit as it is typed.
    for (const partial of ["0002-09-30", "0020-09-30", "0202-09-30"]) {
      fireEvent.change(to, { target: { value: partial } });
      expect(to).toHaveValue(partial);
    }
    expect(filter.onRangeChange).not.toHaveBeenCalled();
    fireEvent.change(to, { target: { value: "2026-09-30" } });
    expect(filter.onRangeChange).toHaveBeenCalledTimes(1);
    expect(filter.onRangeChange).toHaveBeenCalledWith({
      from: null,
      to: "2026-09-30",
    });
  });

  it("shows a new range from the host in place of what was typed", () => {
    const filter = rangeFilter();
    const { rerender } = render(
      <FilterPicker filter={filter} variant="popover" />
    );
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "0020-01-01" },
    });
    rerender(
      <FilterPicker
        filter={{ ...filter, range: { from: "2026-01-01", to: null } }}
        variant="popover"
      />
    );
    expect(screen.getByLabelText("From")).toHaveValue("2026-01-01");
  });

  it("reads the host's label rather than a count", () => {
    expect(
      filterSelectionText(rangeFilter({ valueLabel: "Since Sep 1, 2026" }))
    ).toBe("Since Sep 1, 2026");
  });
});

describe("filterSelectionText (list-views §4.3)", () => {
  it("prefers the host's label for several values, else counts them", () => {
    expect(
      filterSelectionText(
        optionsFilter({ selected: ["new", "confirmed"], valueLabel: "Open" })
      )
    ).toBe("Open");
    expect(
      filterSelectionText(optionsFilter({ selected: ["new", "confirmed"] }))
    ).toBe("2 selected");
    expect(filterSelectionText(optionsFilter())).toBeNull();
  });
});
