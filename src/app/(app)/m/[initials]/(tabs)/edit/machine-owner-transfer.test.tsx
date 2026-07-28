import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineOwnerTransfer } from "./machine-owner-transfer";
import { updateMachineAction } from "~/app/(app)/m/actions";
import { err } from "~/lib/result";

vi.mock("~/app/(app)/m/actions", () => ({
  updateMachineAction: vi.fn(),
}));

// OwnerSelect is a Popover + cmdk picker; swap it for a plain select that
// honours the same `onValueChange` contract.
vi.mock("~/components/machines/OwnerSelect", () => ({
  OwnerSelect: ({ onValueChange }: { onValueChange: (id: string) => void }) => (
    <select
      aria-label="Owner"
      onChange={(e) => onValueChange(e.target.value)}
      defaultValue=""
    >
      <option value="">Unassigned</option>
      <option value="owner-1">Current Owner</option>
      <option value="owner-2">New Owner</option>
    </select>
  ),
}));

const baseProps = {
  machineId: "11111111-1111-1111-1111-111111111111",
  machineName: "Godzilla (Premium)",
  ownerId: "owner-1",
  invitedOwnerId: null,
  ownerName: "Current Owner",
  invitedOwnerName: null,
  allUsers: [],
  canEditAnyMachine: true,
  isOwner: false,
};

describe("MachineOwnerTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the current owner before the disclosure is opened", () => {
    render(<MachineOwnerTransfer {...baseProps} />);
    expect(screen.getByText(/Owned by Current Owner/)).toBeVisible();
    expect(screen.queryByLabelText("Owner")).not.toBeInTheDocument();
  });

  it("reveals the picker when Change owner is clicked", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);

    await user.click(screen.getByTestId("open-owner-transfer"));

    expect(screen.getByLabelText("Owner")).toBeVisible();
  });

  it("keeps Transfer disabled until a different owner is picked", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));

    const submit = screen.getByRole("button", { name: "Transfer ownership" });
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Owner"), "owner-2");

    expect(submit).toBeEnabled();
  });

  it("carries the current name so the shared update action's required field is satisfied", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));

    const nameField =
      document.querySelector<HTMLInputElement>('input[name="name"]');
    expect(nameField?.value).toBe("Godzilla (Premium)");
  });

  it("does not submit a description field, so a transfer cannot clear it", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));

    expect(document.querySelector('input[name="description"]')).toBeNull();
  });

  it("announces a failed transfer as a live-region alert", async () => {
    vi.mocked(updateMachineAction).mockResolvedValue(
      err("SERVER", "Something went wrong transferring ownership.")
    );
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));
    await user.selectOptions(screen.getByLabelText("Owner"), "owner-2");
    await user.click(
      screen.getByRole("button", { name: "Transfer ownership" })
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Something went wrong transferring ownership."
    );
  });
});
