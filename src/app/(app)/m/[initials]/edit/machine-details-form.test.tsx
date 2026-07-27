import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineDetailsForm } from "./machine-details-form";
import { updateMachineAction } from "~/app/(app)/m/actions";
import { err } from "~/lib/result";

vi.mock("~/app/(app)/m/actions", () => ({
  updateMachineAction: vi.fn(),
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

vi.mock("~/components/machines/PinballMapLinkField", () => ({
  PinballMapLinkField: () => <div data-testid="pbm-link-field" />,
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
});
