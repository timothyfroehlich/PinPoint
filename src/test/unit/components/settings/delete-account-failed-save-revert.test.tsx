/**
 * Reproduction + regression guard for PP-1ajq on `DeleteAccountSection`.
 *
 * This is the consequential variant of the hazard. The machine-reassignment
 * Select is controlled (`value={reassignTo}`), but @radix-ui/react-select
 * >=2.3.3 replays its mount-time value through `onValueChange` on a form
 * `reset` — which React 19 fires automatically once a `<form action={...}>`
 * action settles, failure included. The dialog has no close-on-failure path,
 * so after a failed delete:
 *
 *   1. `reassignTo` snaps back to "__unassigned__", and with it the hidden
 *      `input[name="reassignTo"]` the action actually reads goes empty;
 *   2. the confirmation text is controlled, so it SURVIVES the reset and the
 *      destructive submit button stays enabled.
 *
 * Together that means a user who picked a new owner, hit a transient failure,
 * and clicked delete again would have deleted their account with their
 * machines silently left unassigned — the exact choice they made having been
 * discarded without any visible change to the confirmation state.
 *
 * `useActionState` is NOT mocked; the point is to run React 19's real
 * post-action reset.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { DeleteAccountSection } from "~/app/(app)/settings/delete-account-section";
import { deleteAccountAction } from "~/app/(app)/settings/actions";

vi.mock("~/app/(app)/settings/actions", () => ({
  deleteAccountAction: vi.fn(),
}));

const MEMBERS = [
  { id: "user-2", name: "Ada Lovelace" },
  { id: "user-3", name: "Grace Hopper" },
];

function hiddenReassignInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    'input[name="reassignTo"]'
  );
  if (!input) throw new Error('hidden input[name="reassignTo"] not found');
  return input;
}

describe("DeleteAccountSection — a failed delete must not discard the reassignment (PP-1ajq)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteAccountAction).mockResolvedValue({
      ok: false,
      code: "SERVER",
      message: "Could not delete your account. Please try again.",
    });
  });

  it("keeps the chosen new owner selected after the action fails", async () => {
    const user = userEvent.setup();
    render(
      <DeleteAccountSection
        ownedMachineCount={2}
        members={MEMBERS}
        isSoleAdmin={false}
      />
    );

    await user.click(screen.getByTestId("delete-account-trigger"));

    // Pick a real new owner for the machines.
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Ada Lovelace" }));
    expect(hiddenReassignInput().value).toBe("user-2");

    await user.type(screen.getByTestId("delete-confirmation-input"), "DELETE");
    await user.click(screen.getByTestId("delete-account-confirm"));

    await waitFor(() => {
      expect(
        screen.getByText("Could not delete your account. Please try again.")
      ).toBeInTheDocument();
    });

    // Let React's post-action reset commit before asserting it didn't land.
    await waitFor(() => {
      expect(screen.getByTestId("delete-account-confirm")).not.toBeDisabled();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The reassignment the user chose must survive the failure — both in the
    // visible trigger and in the hidden field the server action reads.
    expect.soft(screen.getByRole("combobox")).toHaveTextContent("Ada Lovelace");
    expect.soft(hiddenReassignInput().value).toBe("user-2");
  });
});
