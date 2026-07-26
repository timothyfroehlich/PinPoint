/**
 * Reproduction + regression guard for PP-1ajq, the second shape of the
 * PP-0fvr hazard.
 *
 * React 19 automatically fires a `reset` on a `<form action={...}>` once the
 * action settles — on success AND on failure, since React only sees that the
 * action returned. `EditMachineDialog` keeps its dialog open on a failed save
 * (it only closes on `state.ok`), so the reset lands on a form the user is
 * still looking at:
 *
 *   - the uncontrolled `<Input name="name" defaultValue={machine.name}>`
 *     snaps back to the machine's stored name, and
 *   - `@radix-ui/react-select` >=2.3.3 attaches its own form-`reset` listener
 *     that replays the Select's mount-time value through `onValueChange`, so
 *     the Availability Select snaps back to the stored presence status.
 *
 * Both happen silently while the error banner is on screen, so the user
 * retries against fields that no longer hold what they typed.
 *
 * Unlike the PP-0fvr guard this test asserts on *rendered form state after a
 * failed action*, not on call counts — there is no spurious second write here
 * (the form submits from a real button, not from `onValueChange`). As in
 * PP-0fvr, `useActionState` is NOT mocked: the whole point is to let React
 * 19's real post-action reset mechanics run.
 */
import type React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { EditMachineDialog } from "~/app/(app)/m/[initials]/update-machine-form";
import { updateMachineAction } from "~/app/(app)/m/actions";

// The dynamic Tiptap editor does not render synchronously in jsdom.
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: () => <div data-testid="mock-rich-text-editor" />,
}));

vi.mock("~/app/(app)/m/actions", () => ({
  updateMachineAction: vi.fn(),
}));

// Client children that transitively import server-action modules at load time.
vi.mock("~/components/machines/OwnerSelect", () => ({
  OwnerSelect: () => <div data-testid="mock-owner-select" />,
}));
vi.mock("~/components/machines/PinballMapLinkField", () => ({
  PinballMapLinkField: () => <div data-testid="mock-pbm-link-field" />,
}));

type Props = React.ComponentProps<typeof EditMachineDialog>;

const ORIGINAL_NAME = "Medieval Madness";
const EDITED_NAME = "Medieval Madness (Remake)";

function makeProps(): Props {
  return {
    machine: {
      id: "mach-1",
      name: ORIGINAL_NAME,
      initials: "MM",
      presenceStatus: "on_the_floor",
      ownerId: null,
      invitedOwnerId: null,
      owner: null,
      invitedOwner: null,
      pinballmapMachineId: null,
      pinballmapExcluded: false,
      pinballmapExcludedReason: null,
      pinballmapTitleName: null,
      pinballmapListed: false,
      pinballmapLmxId: null,
      description: null,
    },
    allUsers: [],
    canEditAnyMachine: false,
    isOwner: false,
    canLink: false,
    pinballmapUrl: "https://pinballmap.com/map/?by_location_id=26454",
  };
}

function nameInput(): HTMLInputElement {
  return screen.getByLabelText(/Machine Name/);
}

function availabilityTrigger(): HTMLElement {
  return screen.getByLabelText("Availability");
}

describe("EditMachineDialog — a failed save must not revert the user's edits (PP-1ajq)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateMachineAction).mockResolvedValue({
      ok: false,
      code: "SERVER",
      message: "Something went wrong. Please try again.",
    });
  });

  it("keeps the edited name and Availability selection on screen after the action fails", async () => {
    const user = userEvent.setup();
    render(<EditMachineDialog {...makeProps()} />);

    await user.click(screen.getByTestId("edit-machine-button"));

    // Edit the uncontrolled text field...
    await user.clear(nameInput());
    await user.type(nameInput(), EDITED_NAME);
    expect(nameInput().value).toBe(EDITED_NAME);

    // ...and the Radix Select, through a real interaction.
    await user.click(availabilityTrigger());
    await user.click(screen.getByRole("option", { name: "Off the Floor" }));
    expect(availabilityTrigger()).toHaveTextContent("Off the Floor");

    await user.click(screen.getByRole("button", { name: "Update Machine" }));

    // The save fails, so the dialog stays open and shows the error banner.
    await waitFor(() => {
      expect(
        screen.getByText("Something went wrong. Please try again.")
      ).toBeInTheDocument();
    });

    // React's post-action reset lands in a later commit than the error banner,
    // so give it room to land before asserting it did NOT clobber the form.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Update Machine" })
      ).not.toBeDisabled();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Soft so a regression reports BOTH halves of the revert (the uncontrolled
    // input and the Radix Select) rather than stopping at the first.
    expect.soft(nameInput().value).toBe(EDITED_NAME);
    expect.soft(availabilityTrigger()).toHaveTextContent("Off the Floor");
  });
});
