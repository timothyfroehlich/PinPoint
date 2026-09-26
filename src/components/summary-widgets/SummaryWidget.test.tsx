import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WidgetPopulation } from "~/lib/types";
import { SummaryWidget, type SummaryWidgetSegment } from "./SummaryWidget";

const segments: SummaryWidgetSegment<"up" | "down">[] = [
  {
    value: "up",
    label: "Up",
    count: 4,
    textClassName: "text-success",
    fillClassName: "bg-success",
  },
  {
    value: "down",
    label: "Down",
    count: 0,
    textClassName: "text-destructive-text",
    fillClassName: "bg-destructive",
  },
];

function renderWidget(population: WidgetPopulation = "all") {
  const onSegmentSelect = vi.fn();
  const onPopulationChange = vi.fn();
  render(
    <SummaryWidget
      id="test-widget"
      label="Status"
      population={population}
      onPopulationChange={onPopulationChange}
      headline={{ figure: 4, text: "up", accentClassName: "text-success" }}
      segments={segments}
      selectedValue={null}
      onSegmentSelect={onSegmentSelect}
    />
  );
  return { onSegmentSelect, onPopulationChange };
}

describe("SummaryWidget", () => {
  it("selects a Segment by its value", async () => {
    const user = userEvent.setup();
    const { onSegmentSelect } = renderWidget();

    await user.click(screen.getByRole("button", { name: "4 Up" }));

    expect(onSegmentSelect).toHaveBeenCalledWith("up");
  });

  it("lists a zero Segment but keeps it unselectable", () => {
    renderWidget();

    expect(screen.getByRole("button", { name: "0 Down" })).toBeDisabled();
  });

  it("marks the chosen population and offers the other", async () => {
    const user = userEvent.setup();
    const { onPopulationChange } = renderWidget("filtered");

    expect(screen.getByRole("button", { name: "Filtered" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const all = screen.getByRole("button", { name: "All" });
    expect(all).toHaveAttribute("aria-pressed", "false");

    await user.click(all);
    expect(onPopulationChange).toHaveBeenCalledWith("all");
  });
});
