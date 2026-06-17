import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

import { SettingsTab } from "~/components/machines/settings/SettingsTab";
import { saveSettingsSetAction } from "~/app/(app)/m/[initials]/(tabs)/settings/actions";
import type { SettingsSetData } from "~/lib/machines/settings-types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

// Stub the rich-text editor/display so the per-unit edit wiring is tested
// without Tiptap (the dynamic editor doesn't render synchronously in jsdom).
// The mock editor exposes a real <textbox> labelled by `ariaLabel` and a button
// that pushes a non-empty doc through `onChange`, letting us drive a dirty draft
// + Save commit deterministically.
const SAMPLE_DOC: ProseMirrorDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Edited body" }] },
  ],
};
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({
    ariaLabel,
    onChange,
  }: {
    ariaLabel?: string;
    onChange?: (doc: ProseMirrorDoc) => void;
  }) => (
    <div>
      <textarea aria-label={ariaLabel} />
      <button
        type="button"
        onClick={() => {
          onChange?.(SAMPLE_DOC);
        }}
      >
        type-in-{ariaLabel}
      </button>
    </div>
  ),
}));
vi.mock("~/components/editor/RichTextDisplay", () => ({
  RichTextDisplay: () => <div data-testid="mock-display" />,
}));

// Mock the server actions module — these tests exercise the client edit/atomic-
// commit wiring (per-unit Edit/Save → one whole-row persist of that unit's slice
// onto the committed baseline), not persistence itself.
vi.mock("~/app/(app)/m/[initials]/(tabs)/settings/actions", () => ({
  saveSettingsSetAction: vi.fn(),
  deleteSettingsSetAction: vi.fn(),
  duplicateSettingsSetAction: vi.fn(),
  setPreferredSettingsSetAction: vi.fn(),
  updateMachineSettingsInstructionsAction: vi.fn(),
}));

const saveMock = vi.mocked(saveSettingsSetAction);

// useIsMobile reads window.matchMedia in an effect; jsdom doesn't implement it.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, // desktop-shaped (inline cells, not the mobile sheet)
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

beforeEach(() => {
  saveMock.mockReset();
  // Default: a successful UPDATE of the existing set.
  saveMock.mockResolvedValue({ success: true, id: "set-1", changed: true });
});

function oneSet(): SettingsSetData {
  return {
    id: "set-1",
    name: "Tournament",
    isPreferred: false,
    updatedBy: "You",
    updatedAt: "2026-06-09",
    description: null,
    sections: [
      {
        id: "sec-sw",
        kind: "software",
        baseline: "Competition Install",
        rows: [
          { _key: "k1", id: "A.1 01", name: "Balls Per Game", value: "3" },
        ],
      },
    ],
  };
}

// A set with two note sections so we can exercise Move up/down reordering and
// the rich-body-on-Save commit + cross-unit isolation.
function twoNoteSet(): SettingsSetData {
  return {
    id: "set-1",
    name: "Tournament",
    isPreferred: false,
    updatedBy: "You",
    updatedAt: "2026-06-09",
    description: null,
    sections: [
      {
        id: "sec-a",
        kind: "note",
        title: "Post positions",
        body: null,
        customTitle: false,
      },
      {
        id: "sec-b",
        kind: "note",
        title: "Rubbers",
        body: null,
        customTitle: false,
      },
    ],
  };
}

describe("SettingsTab — atomic per-unit commit model", () => {
  it("a permitted user sees the set's Edit button but NO editable name until they click it", () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[oneSet()]}
        settingsInstructions={null}
      />
    );

    // At rest the set-header unit shows a visible "Edit set details" button and
    // the name is plain text — there is no name input.
    expect(
      screen.getByRole("button", { name: "Edit set details" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "set name" })
    ).not.toBeInTheDocument();
  });

  it("editing the name BUFFERS — no save fires on blur; the unit's Save persists it", async () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[oneSet()]}
        settingsInstructions={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit set details" }));
    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Casual" } });
    // Blur commits the value into the WORKING COPY only — no persistence yet.
    fireEvent.blur(input);
    expect(saveMock).not.toHaveBeenCalled();

    // The header unit's Save persists exactly this unit's slice.
    fireEvent.click(screen.getByRole("button", { name: "Save set details" }));
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ machineId: "m1", id: "set-1", name: "Casual" })
    );
  });

  it("Cancel reverts the buffered name draft and closes the unit", () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[oneSet()]}
        settingsInstructions={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit set details" }));
    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Throwaway" } });
    fireEvent.blur(input);

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel editing set details" })
    );
    // Nothing persisted, the unit closed, and the original name is shown.
    expect(saveMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("textbox", { name: "set name" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Tournament")).toBeInTheDocument();
  });

  it("surfaces an inline error on failure without losing the typed value; Save retries", async () => {
    saveMock.mockResolvedValue({ success: false, error: "Network error" });
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[oneSet()]}
        settingsInstructions={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit set details" }));
    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Casual" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("button", { name: "Save set details" }));

    // The failed save shows an inline error; the unit stays open with the typed
    // value ("Casual") preserved in the input.
    await screen.findByText("Network error");
    expect(screen.getByRole("textbox", { name: "set name" })).toHaveValue(
      "Casual"
    );

    // Save again = Retry. Make it succeed this time.
    saveMock.mockResolvedValue({ success: true, id: "set-1", changed: true });
    fireEvent.click(screen.getByRole("button", { name: "Save set details" }));
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(2);
    });
    expect(saveMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Casual" })
    );
  });

  it("shows no edit affordances at all to read-only viewers", () => {
    render(
      <SettingsTab
        canEdit={false}
        machineId="m1"
        initialSets={[oneSet()]}
        settingsInstructions={null}
      />
    );
    expect(
      screen.queryByRole("button", { name: /^Edit/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More options for this set" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add section/ })
    ).not.toBeInTheDocument();
  });

  it("a section's rich body is editable only AFTER clicking that section's Edit", () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[twoNoteSet()]}
        settingsInstructions={null}
      />
    );

    // At rest, an empty note body renders nothing and no rich editor is mounted.
    expect(
      screen.queryByRole("textbox", { name: "Edit text" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit the Post positions section" })
    );
    expect(
      screen.getByRole("textbox", { name: "Edit text" })
    ).toBeInTheDocument();
  });

  it("buffers the rich body until the section's Save (one whole-row write)", async () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[twoNoteSet()]}
        settingsInstructions={null}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit the Post positions section" })
    );
    // Typing into the body streams into the working copy but does NOT persist.
    fireEvent.click(screen.getByRole("button", { name: "type-in-Edit text" }));
    expect(saveMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Save the Post positions section" })
    );
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    // The persisted slice carries the edited body for sec-a.
    const payload = saveMock.mock.calls[0]?.[0];
    const secA = payload?.sections.find((s) => s.id === "sec-a");
    expect(secA?.kind === "note" ? secA.body : null).toEqual(SAMPLE_DOC);
  });

  it("saving one section does NOT persist another open section's edits (atomicity)", async () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[twoNoteSet()]}
        settingsInstructions={null}
      />
    );

    // Open BOTH sections and type a draft body into each.
    fireEvent.click(
      screen.getByRole("button", { name: "Edit the Post positions section" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Edit the Rubbers section" })
    );
    const typeButtons = screen.getAllByRole("button", {
      name: "type-in-Edit text",
    });
    // Two editors are open; type into both working copies.
    for (const btn of typeButtons) fireEvent.click(btn);

    // Save ONLY the Post positions section.
    fireEvent.click(
      screen.getByRole("button", { name: "Save the Post positions section" })
    );
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    const payload = saveMock.mock.calls[0]?.[0];
    const secA = payload?.sections.find((s) => s.id === "sec-a");
    const secB = payload?.sections.find((s) => s.id === "sec-b");
    // sec-a's slice committed; sec-b's open draft is EXCLUDED (still baseline
    // null) — the merge starts from baseline and overlays only sec-a.
    expect(secA?.kind === "note" ? secA.body : "x").toEqual(SAMPLE_DOC);
    expect(secB?.kind === "note" ? secB.body : "x").toBeNull();

    // The Rubbers section stays open (unsaved).
    expect(
      screen.getByRole("button", { name: "Save the Rubbers section" })
    ).toBeInTheDocument();
  });

  it("reorders a section with the kebab's Move down and persists immediately from baseline", async () => {
    const user = userEvent.setup();
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[twoNoteSet()]}
        settingsInstructions={null}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "More options for the Post positions section",
      })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Move down" })
    );

    // The order change persists a whole-row save with Rubbers now first.
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    const payload = saveMock.mock.calls[0]?.[0];
    expect(payload?.sections.map((s) => s.id)).toEqual(["sec-b", "sec-a"]);
  });

  it("a new set's header opens in edit and inserts on its first Save", async () => {
    saveMock.mockResolvedValue({
      success: true,
      id: "server-uuid",
      changed: true,
    });
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[]}
        settingsInstructions={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New set" }));
    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Brand new" } });
    fireEvent.blur(input);
    // Buffered, not yet inserted.
    expect(saveMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save set details" }));
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    // An insert has no id field; the name is sent.
    const payload = saveMock.mock.calls[0]?.[0];
    expect(payload?.id).toBeUndefined();
    expect(payload?.name).toBe("Brand new");
  });
});
