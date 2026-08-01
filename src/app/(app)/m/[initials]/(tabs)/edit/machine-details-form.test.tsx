import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineDetailsForm } from "./machine-details-form";
import { updateMachineAction } from "~/app/(app)/m/actions";
import { err, ok } from "~/lib/result";
import type { UpdateMachineResult } from "~/app/(app)/m/actions";

vi.mock("~/app/(app)/m/actions", () => ({
  updateMachineAction: vi.fn(),
}));

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
}));

// The real editor is a dynamic TipTap import. Swap it for a textarea that
// pushes a ProseMirror-shaped doc through the same onChange contract.
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({
    onChange,
    ariaLabel,
  }: {
    onChange: (doc: unknown) => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      onChange={(e) =>
        onChange({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: e.target.value }],
            },
          ],
        })
      }
    />
  ),
}));

// Stubbed, but the stub exposes `onDirty` so the wiring is testable: the real
// picker's controls (cmdk items, a Radix Select) never bubble `input`, so the
// callback is the ONLY way the form learns a PBM change happened.
vi.mock("~/components/machines/PinballMapLinkField", () => ({
  PinballMapLinkField: ({ onDirty }: { onDirty?: () => void }) => (
    <div data-testid="pbm-link-field">
      <button type="button" onClick={() => onDirty?.()}>
        stub-pbm-change
      </button>
    </div>
  ),
}));

const baseProps = {
  machineId: "11111111-1111-1111-1111-111111111111",
  name: "Godzilla (Premium)",
  presenceStatus: "on_the_floor" as const,
  description: null,
  canLink: true,
  pinballmapMachineId: 42,
  pinballmapExcluded: false,
  pinballmapExcludedReason: null,
  pinballmapTitleName: "Godzilla (Premium)",
};

function hiddenDescription(): HTMLInputElement {
  const field = document.querySelector<HTMLInputElement>(
    'input[name="description"]'
  );
  if (!field) throw new Error("hidden description field not rendered");
  return field;
}

describe("MachineDetailsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockClear();
  });

  /** Dispatch a cancelable beforeunload and report whether anything blocked it. */
  function beforeUnloadWasBlocked(): boolean {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it("does not block unload when the form is untouched", () => {
    render(<MachineDetailsForm {...baseProps} />);
    expect(beforeUnloadWasBlocked()).toBe(false);
  });

  it("blocks unload once the form is dirty", async () => {
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText(/Machine Name/), "!");

    expect(beforeUnloadWasBlocked()).toBe(true);
  });

  it("stops blocking unload after Cancel reverts the edits", async () => {
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(beforeUnloadWasBlocked()).toBe(false);
  });

  it("serializes the editor's doc into the hidden description input", async () => {
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText("Machine description"), "Hi");

    expect(JSON.parse(hiddenDescription().value)).toMatchObject({
      type: "doc",
    });
  });

  it("serializes a null description to an empty string", () => {
    render(<MachineDetailsForm {...baseProps} />);
    expect(hiddenDescription().value).toBe("");
  });

  it("shows an unsaved-changes note once a field is edited", async () => {
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "No unsaved changes"
    );

    await user.type(screen.getByLabelText(/Machine Name/), "!");

    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "Unsaved changes"
    );
  });

  it("restores the original name, availability, and description on Cancel", async () => {
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    const nameInput = screen.getByLabelText(/Machine Name/);
    await user.type(nameInput, "!");
    expect(nameInput).toHaveValue("Godzilla (Premium)!");

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Off the Floor" }));
    expect(screen.getByRole("combobox")).toHaveTextContent("Off the Floor");

    await user.type(screen.getByLabelText("Machine description"), "draft");
    expect(hiddenDescription().value).not.toBe("");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText(/Machine Name/)).toHaveValue(
      "Godzilla (Premium)"
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("On the Floor");
    expect(hiddenDescription().value).toBe("");
    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "No unsaved changes"
    );
  });

  it("announces a failed save as a live-region alert", async () => {
    vi.mocked(updateMachineAction).mockResolvedValue(
      err("SERVER", "Something went wrong saving these details.")
    );
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Save details" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Something went wrong saving these details."
    );
  });

  it("submits the live DOM values, not the mount-time defaults", async () => {
    vi.mocked(updateMachineAction).mockResolvedValue(
      ok({ machineId: baseProps.machineId })
    );
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Off the Floor" }));
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => {
      expect(updateMachineAction).toHaveBeenCalled();
    });
    const fd = vi.mocked(updateMachineAction).mock.calls[0]?.[1];
    expect(fd?.get("name")).toBe("Godzilla (Premium)!");
    expect(fd?.get("presenceStatus")).toBe("off_the_floor");
    expect(fd?.get("id")).toBe(baseProps.machineId);
  });

  /**
   * Regression guard for PP-1ajq in this form.
   *
   * React 19 fires a `reset` on a `<form action={...}>` once the action
   * settles — on failure as well as success. This page stays put on failure,
   * so that reset used to snap the uncontrolled name Input back to its
   * `defaultValue` and let @radix-ui/react-select >=2.3.3 replay Availability's
   * mount-time value through its own form-`reset` listener: silent data loss
   * under an error banner. `useActionState` is deliberately NOT mocked here —
   * the point is to let React 19's real post-action mechanics run.
   */
  it("keeps the user's edits after a failed save (PP-1ajq)", async () => {
    vi.mocked(updateMachineAction).mockResolvedValue(
      err("SERVER", "Something went wrong saving these details.")
    );
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Off the Floor" }));

    await user.click(screen.getByRole("button", { name: "Save details" }));
    await screen.findByRole("alert");

    // The reset would land in a later commit than the error banner, so wait
    // for the pending state to clear and give React room before asserting.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Save details" })
      ).not.toBeDisabled();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Soft so a regression reports BOTH halves of the revert rather than
    // stopping at the first.
    expect
      .soft(screen.getByLabelText(/Machine Name/))
      .toHaveValue("Godzilla (Premium)!");
    expect
      .soft(screen.getByRole("combobox"))
      .toHaveTextContent("Off the Floor");
  });

  // Name and Availability sit side by side at `@xl` (see the layout comment in
  // machine-details-form.tsx). CSS grid placement does NOT reorder the DOM, so
  // pairing them changed the keyboard path to Name → Availability → Model. That
  // was accepted deliberately for the vertical space, but it is exactly the
  // kind of decision that gets silently undone by a later layout tweak — so
  // pin the order itself rather than the Tailwind classes that produce it.
  it("marks the section dirty when the PinballMap picker changes", async () => {
    // The picker used to leave the note reading "No unsaved changes" over a
    // real pending edit, so Cancel discarded it with no signal
    // (PP-o355.19 review).
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "No unsaved changes"
    );

    await user.click(screen.getByRole("button", { name: "stub-pbm-change" }));

    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "Unsaved changes"
    );
  });

  it("clears a failed-save banner when the user cancels", async () => {
    // Cancel reverts the edits the banner is describing, so leaving it on
    // screen reports a failure about values that are no longer there.
    vi.mocked(updateMachineAction).mockResolvedValue(
      err("SERVER", "Something went wrong saving these details.")
    );
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "No unsaved changes"
    );
  });

  it("keeps keyboard order Name → Availability → PinballMap fields", () => {
    render(<MachineDetailsForm {...baseProps} />);

    const name = screen.getByLabelText(/Machine Name/);
    const availability = screen.getByRole("combobox");
    const pinballMapFields = screen.getByTestId("pbm-link-field");

    const follows = (a: Element, b: Element): boolean =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect.soft(follows(name, availability)).toBe(true);
    expect.soft(follows(availability, pinballMapFields)).toBe(true);
  });

  it("keeps guarding edits made while a save is in flight", async () => {
    // The action resolves only when we say so, so we can type mid-flight.
    let resolveSave: (value: UpdateMachineResult) => void = () => undefined;
    vi.mocked(updateMachineAction).mockReturnValue(
      new Promise<UpdateMachineResult>((resolve) => {
        resolveSave = resolve;
      })
    );
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    // Typed AFTER the FormData snapshot was taken — never submitted.
    await user.type(screen.getByLabelText(/Machine Name/), "?");

    // `act` so the resolution, its re-render, and the success effect have all
    // flushed before we assert — a `waitFor` on the button resolves BEFORE the
    // action settles, which made this assertion pass against the bug.
    await act(async () => {
      resolveSave(ok({ machineId: baseProps.machineId }));
      await Promise.resolve();
    });

    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "Unsaved changes"
    );
  });

  describe("unsaved-changes navigation guard", () => {
    /** A tab-strip-style link rendered as a sibling, like RouteTabStrip's. */
    function renderWithTabLink(): void {
      render(
        <>
          <a href="/m/TAF/settings">Settings</a>
          <MachineDetailsForm {...baseProps} />
        </>
      );
    }

    it("lets a link through when the form is untouched", async () => {
      const user = userEvent.setup();
      renderWithTabLink();

      await user.click(screen.getByRole("link", { name: "Settings" }));

      expect(
        screen.queryByText("Discard unsaved changes?")
      ).not.toBeInTheDocument();
    });

    it("intercepts a link and asks before discarding", async () => {
      const user = userEvent.setup();
      renderWithTabLink();

      await user.type(screen.getByLabelText(/Machine Name/), "!");
      await user.click(screen.getByRole("link", { name: "Settings" }));

      expect(
        await screen.findByText("Discard unsaved changes?")
      ).toBeInTheDocument();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("stays put and keeps the edits when the user keeps editing", async () => {
      const user = userEvent.setup();
      renderWithTabLink();

      await user.type(screen.getByLabelText(/Machine Name/), "!");
      await user.click(screen.getByRole("link", { name: "Settings" }));
      await user.click(
        await screen.findByRole("button", { name: "Keep editing" })
      );

      expect(pushMock).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/Machine Name/)).toHaveValue(
        "Godzilla (Premium)!"
      );
    });

    it("completes the navigation when the user discards", async () => {
      const user = userEvent.setup();
      renderWithTabLink();

      await user.type(screen.getByLabelText(/Machine Name/), "!");
      await user.click(screen.getByRole("link", { name: "Settings" }));
      await user.click(
        await screen.findByRole("button", { name: "Discard changes" })
      );

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith("/m/TAF/settings");
      });
    });

    it("lets a link to the current page through", async () => {
      const user = userEvent.setup();
      render(
        <>
          <a href="/">Here</a>
          <MachineDetailsForm {...baseProps} />
        </>
      );

      await user.type(screen.getByLabelText(/Machine Name/), "!");
      await user.click(screen.getByRole("link", { name: "Here" }));

      expect(
        screen.queryByText("Discard unsaved changes?")
      ).not.toBeInTheDocument();
    });
  });
});
