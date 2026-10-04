import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListToolbar } from "./ListToolbar";
import { describeSelection, type ListFilterModel } from "./types";

const LONG_NAME = "Bartholomew Montgomery-Fitzgerald the Third";

/**
 * jsdom lays nothing out, so the toolbar row and the measured filter faces
 * get widths here: the row is 700px and a face is 10px per character, so
 * Owner fits beside search until it shows the long name.
 */
function stubLayout(): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const isRow =
        this.querySelector(':scope > [role="group"][aria-label="Filters"]') !==
        null;
      const width = isRow
        ? 700
        : this.hasAttribute("data-measure")
          ? (this.textContent?.length ?? 0) * 10
          : 0;
      return DOMRect.fromRect({ width, height: 32 });
    }
  );
}

function Host(): React.JSX.Element {
  const [owner, setOwner] = React.useState<string[]>([]);
  const options = [{ value: "person-1", label: LONG_NAME }];
  const filters: ListFilterModel[] = [
    {
      id: "presence",
      label: "Presence",
      options: [{ value: "on_the_floor", label: "On the Floor" }],
      selected: [],
      valueLabel: null,
      atPreset: true,
      onChange: vi.fn(),
      onReset: vi.fn(),
    },
    {
      id: "owner",
      label: "Owner",
      options,
      selected: owner,
      valueLabel: describeSelection(owner, options),
      atPreset: owner.length === 0,
      onChange: setOwner,
      onReset: () => setOwner([]),
    },
  ];
  return (
    <ListToolbar
      search={<input aria-label="Search" />}
      primaryFilters={filters}
    />
  );
}

describe("ListToolbar", () => {
  beforeEach(stubLayout);
  afterEach(() => vi.restoreAllMocks());

  it("keeps an open filter in place while a choice widens it, then moves it into More (list-views §8.1)", async () => {
    const user = userEvent.setup();
    render(<Host />);

    await user.click(screen.getByTestId("list-filter-owner"));
    await user.click(screen.getByRole("checkbox", { name: LONG_NAME }));

    // The wider Owner no longer fits, but its options stay open for the
    // next choice.
    expect(screen.getByRole("checkbox", { name: LONG_NAME })).toBeChecked();
    expect(screen.queryByTestId("list-filter-more")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("list-filter-owner")).not.toBeInTheDocument();
    expect(screen.getByTestId("list-filter-more")).toBeInTheDocument();
  });
});
