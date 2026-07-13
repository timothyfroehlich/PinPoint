import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineCombobox } from "./MachineCombobox";

const machines = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Grand Prix",
    initials: "GP",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Future Spa",
    initials: "FS",
  },
];

describe("MachineCombobox", () => {
  it("shows the placeholder when nothing is selected", () => {
    render(
      <MachineCombobox machines={machines} value="" onValueChange={vi.fn()} />
    );
    expect(screen.getByText("Select a machine…")).toBeInTheDocument();
  });

  it("filters and selects a machine", async () => {
    const onValueChange = vi.fn();
    render(
      <MachineCombobox
        machines={machines}
        value=""
        onValueChange={onValueChange}
      />
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(
      screen.getByPlaceholderText(/search machines/i),
      "future"
    );
    await userEvent.click(screen.getByText(/Future Spa/));
    expect(onValueChange).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222"
    );
  });

  it("renders the selected machine's name", () => {
    render(
      <MachineCombobox
        machines={machines}
        value={machines[0].id}
        onValueChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Grand Prix/)).toBeInTheDocument();
  });
});
