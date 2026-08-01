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
//
// The mock must also match the real component's SUBMISSION shape: OwnerSelect
// renders `<input type="hidden" name="ownerId">` seeded from `defaultValue`.
// An earlier mock carried neither, so `new FormData(form)` in these tests held
// only `id` — nothing here guarded that the owner reaches the action at all,
// and a wrong `defaultValue` would have gone unnoticed (PP-o355.19 review).
vi.mock("~/components/machines/OwnerSelect", () => ({
  OwnerSelect: ({
    defaultValue,
    onValueChange,
  }: {
    defaultValue?: string | null;
    onValueChange: (id: string) => void;
  }) => (
    <select
      name="ownerId"
      aria-label="Owner"
      onChange={(e) => onValueChange(e.target.value)}
      defaultValue={defaultValue ?? ""}
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

  it("does not submit a name, so a transfer cannot revert a concurrent rename", async () => {
    // This form used to carry a hidden `name` holding a page-load snapshot,
    // purely to satisfy what was then a required schema field. Because the
    // action writes `name` unconditionally, a transfer would silently revert a
    // rename someone else had made in between (PP-o355.19 review). `name` is
    // now optional on update, so the right move is to omit it entirely.
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));

    expect(document.querySelector('input[name="name"]')).toBeNull();
  });

  it("does not submit a description field, so a transfer cannot clear it", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));

    expect(document.querySelector('input[name="description"]')).toBeNull();
  });

  it("submits the picked owner as `ownerId` alongside the machine id", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));
    await user.selectOptions(screen.getByLabelText("Owner"), "owner-2");
    await user.click(
      screen.getByRole("button", { name: "Transfer ownership" })
    );

    // useActionState calls the action as (prevState, formData).
    const fd = vi.mocked(updateMachineAction).mock.calls[0]?.[1];
    expect(fd?.get("ownerId")).toBe("owner-2");
    expect(fd?.get("id")).toBe(baseProps.machineId);
  });

  it("re-syncs against the current owner when a concurrent transfer lands", async () => {
    // Another editor moves the machine while this page is open. The server
    // re-renders with the new owner; this client component keeps its state.
    // Reopening the disclosure must judge against the NEW owner, otherwise
    // Transfer is enabled with nothing picked (PP-o355.19 review).
    const user = userEvent.setup();
    const { rerender } = render(<MachineOwnerTransfer {...baseProps} />);

    rerender(
      <MachineOwnerTransfer
        {...baseProps}
        ownerId="owner-2"
        ownerName="New Owner"
      />
    );
    await user.click(screen.getByTestId("open-owner-transfer"));

    expect(
      screen.getByRole("button", { name: "Transfer ownership" })
    ).toBeDisabled();
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
