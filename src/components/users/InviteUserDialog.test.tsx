import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InviteUserDialog } from "./InviteUserDialog";

vi.mock("~/app/(app)/admin/users/actions", () => ({
  inviteUser: vi.fn(),
}));

/**
 * Wrapper that manages open/close state so the dialog can be tested
 * in a controlled fashion.
 */
function Wrapper({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <InviteUserDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

describe("InviteUserDialog", () => {
  it("clears form inputs when dialog is closed and reopened", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    // Fill in fields
    await user.type(screen.getByLabelText(/First Name/i), "Reset");
    await user.type(screen.getByLabelText(/Last Name/i), "Probe");
    await user.type(screen.getByLabelText(/^Email/), "reset@example.com");

    // Cancel closes dialog (Radix unmounts DialogContent)
    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    // Reopen — Radix remounts a fresh InviteUserForm
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByLabelText(/First Name/i)).toHaveValue("");
    expect(screen.getByLabelText(/Last Name/i)).toHaveValue("");
    expect(screen.getByLabelText(/^Email/)).toHaveValue("");
  });
});
