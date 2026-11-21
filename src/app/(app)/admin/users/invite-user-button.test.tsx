import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteUserButton } from "./invite-user-button";

vi.mock("~/app/(app)/admin/users/actions", () => ({ inviteUser: vi.fn() }));

/** User Management's create action (design-bible §26). */
describe("InviteUserButton", () => {
  it("is a filled page action that opens the invite dialog and takes focus back", async () => {
    const user = userEvent.setup();
    render(<InviteUserButton />);
    const invite = screen.getByRole("button", { name: "Invite User" });
    expect(invite).toHaveClass("bg-primary");

    await user.click(invite);
    expect(
      await screen.findByRole("dialog", { name: "Invite New User" })
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(invite).toHaveFocus();
  });
});
