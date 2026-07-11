// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MachinePresenceSelect } from "./machine-presence-select";

const mockUpdate = vi.fn();
vi.mock("~/app/(app)/m/actions", () => ({
  updateMachinePresenceAction: (id: string, status: string) =>
    mockUpdate(id, status),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("MachinePresenceSelect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the current availability and offers all five states", async () => {
    const user = userEvent.setup();
    render(<MachinePresenceSelect machineId="m1" value="on_the_floor" />);

    // Trigger reflects the current value.
    expect(screen.getByRole("combobox")).toHaveTextContent("On the Floor");

    await user.click(screen.getByRole("combobox"));

    for (const label of [
      "On the Floor",
      "Off the Floor",
      "On Loan",
      "Pending Arrival",
      "Removed",
    ]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("calls the presence action with the chosen state", async () => {
    mockUpdate.mockResolvedValue({ ok: true, value: { machineId: "m1" } });
    const user = userEvent.setup();
    render(<MachinePresenceSelect machineId="m1" value="on_the_floor" />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Off the Floor" }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("m1", "off_the_floor");
    });
  });
});
