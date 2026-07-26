/**
 * Regression guard for PP-1ajq on `CreateMachineForm`.
 *
 * The form's text fields were already made controlled ("so they survive
 * re-renders after server action errors"), but the Availability Select is
 * uncontrolled (`defaultValue="on_the_floor"`) and @radix-ui/react-select
 * >=2.3.3 replays its mount-time value through `onValueChange` on a form
 * `reset` — which React 19 fires automatically once a `<form action={...}>`
 * action settles, failure included. A failed create leaves the form on screen,
 * so the user's Availability choice silently snapped back to "On the Floor";
 * fixing whatever the server complained about and resubmitting then created
 * the machine with the wrong presence status.
 *
 * `useActionState` is NOT mocked and the Select is the real Radix one — the
 * suite that mocks both is exactly why this class of bug stayed invisible
 * (PP-0fvr).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CreateMachineForm } from "~/app/(app)/m/new/create-machine-form";
import { createMachineAction } from "~/app/(app)/m/actions";

vi.mock("~/app/(app)/m/actions", () => ({
  createMachineAction: vi.fn(),
}));

vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: () => <div data-testid="mock-rich-text-editor" />,
}));

vi.mock("~/components/machines/OwnerSelect", () => ({
  OwnerSelect: () => <div data-testid="mock-owner-select" />,
}));
vi.mock("~/components/machines/PinballMapLinkField", () => ({
  PinballMapLinkField: () => <div data-testid="mock-pbm-link-field" />,
}));

function availabilityTrigger(): HTMLElement {
  return screen.getByLabelText("Availability");
}

describe("CreateMachineForm — a failed create must not revert Availability (PP-1ajq)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createMachineAction).mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Initials are already taken.",
    });
  });

  it("keeps the chosen Availability after the action fails", async () => {
    const user = userEvent.setup();
    render(<CreateMachineForm allUsers={[]} canSelectOwner={false} />);

    await user.type(screen.getByLabelText(/Machine Name/), "Twilight Zone");
    await user.type(screen.getByLabelText(/Initials/), "TZ");

    await user.click(availabilityTrigger());
    await user.click(screen.getByRole("option", { name: "Pending Arrival" }));
    expect(availabilityTrigger()).toHaveTextContent("Pending Arrival");

    await user.click(screen.getByRole("button", { name: /Create Machine/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Initials are already taken.")
      ).toBeInTheDocument();
    });

    // Let React's post-action reset commit before asserting it didn't land.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(availabilityTrigger()).toHaveTextContent("Pending Arrival");
  });
});
