/**
 * SettingsTab — always-live auto-save model (PP-43q3 pivot).
 *
 * Key invariants tested here:
 *   (a) permitted users see always-live inputs — no "Edit" button gating them
 *   (b) typing schedules a debounced save; blur flushes it immediately
 *   (c) read-only viewers see clean static text and NO inputs anywhere
 *   (d) the always-on set-name input carries autocomplete="off" (CORE-FORM)
 *   (e) customTitle NoteSection renders editable title + body with NO Save button
 *       (regression guard for PP-43q3 bug #7)
 */
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

import { SettingsTab } from "~/components/machines/settings/SettingsTab";
import {
  duplicateSettingsSetAction,
  saveSettingsSetAction,
  setPreferredSettingsSetAction,
} from "~/app/(app)/m/[initials]/(tabs)/settings/actions";
import type { SettingsSetData } from "~/lib/machines/settings-types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

// Stub the rich-text editor/display so the auto-save wiring is testable without
// Tiptap (the dynamic editor doesn't render synchronously in jsdom).
// - RichTextEditor: exposes a <textarea> with the ariaLabel and a button that
//   pushes a non-empty doc through onChange, letting us trigger a working-copy
//   update deterministically.
// - RichTextDisplay: renders a sentinel div so we can verify it's used (not an
//   editor) in viewer mode.
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

vi.mock("~/app/(app)/m/[initials]/(tabs)/settings/actions", () => ({
  saveSettingsSetAction: vi.fn(),
  deleteSettingsSetAction: vi.fn(),
  duplicateSettingsSetAction: vi.fn(),
  setPreferredSettingsSetAction: vi.fn(),
  updateMachineSettingsInstructionsAction: vi.fn(),
  updateMachineSettingsRequestsAction: vi.fn(),
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
  // Default: a successful update of the existing set.
  saveMock.mockResolvedValue({ success: true, id: "set-1", changed: true });
  // Note: individual tests that need fake timers call vi.useFakeTimers()
  // themselves and restore via vi.useRealTimers() in a finally / afterEach.
  // Global fake timers break waitFor + findByRole (they use setTimeout
  // internally). Tests that don't need timer control use real timers.
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

function dipSet(): SettingsSetData {
  return {
    id: "set-1",
    name: "Tournament",
    isPreferred: false,
    updatedBy: "You",
    updatedAt: "2026-06-09",
    description: null,
    sections: [
      {
        id: "sec-dip",
        kind: "dip",
        name: "Bank A",
        switches: [{ _key: "sw1", switch: "DS-1", position: "OFF", note: "" }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// (a) Permitted user: always-live inputs, no "Edit" gating
// ---------------------------------------------------------------------------

describe("SettingsTab — always-live auto-save model (PP-43q3 pivot)", () => {
  it("(a) a permitted user sees the set-name input immediately — no Edit button", () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // The name is always-live: an input is present, no "Edit set details" button.
    expect(
      screen.getByRole("textbox", { name: "set name" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit set details" })
    ).not.toBeInTheDocument();
  });

  it("(a) software-settings table cells are always-live inputs for permitted users", () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // The pre-existing row cells are always open.
    expect(
      screen.getByRole("textbox", { name: "Setting name" })
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // (b) Typing schedules a debounced save; blur flushes immediately
  // ---------------------------------------------------------------------------

  it("(b) typing a new set name schedules a debounced save", async () => {
    vi.useFakeTimers();
    try {
      render(
        <SettingsTab
          canEdit
          machineId="m1"
          initialSets={[oneSet()]}
          settingsRequests={null}
          settingsInstructions={null}
        />
      );

      const input = screen.getByRole("textbox", { name: "set name" });
      fireEvent.change(input, { target: { value: "Casual" } });

      // Save is debounced — nothing fires yet.
      expect(saveMock).not.toHaveBeenCalled();

      // Advance fake timers past the 800 ms debounce.
      act(() => {
        vi.advanceTimersByTime(900);
      });

      // Drain the promise queue before asserting.
      await act(async () => {
        await Promise.resolve();
      });

      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          machineId: "m1",
          id: "set-1",
          name: "Casual",
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("(b) blurring the set-name input flushes the save immediately (no 800 ms wait)", async () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Casual" } });

    // Blur triggers immediate flush.
    fireEvent.blur(input);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Casual" })
    );
  });

  // ---------------------------------------------------------------------------
  // (c) Read-only viewer: clean static text, NO inputs anywhere
  // ---------------------------------------------------------------------------

  it("(c) read-only viewer sees plain text for set name — no input", () => {
    render(
      <SettingsTab
        canEdit={false}
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // No inputs for the set name.
    expect(
      screen.queryByRole("textbox", { name: "set name" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Tournament")).toBeInTheDocument();
  });

  it("(c) read-only viewer sees no table-cell inputs — only plain spans", () => {
    render(
      <SettingsTab
        canEdit={false}
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // No text inputs for the settings rows.
    expect(
      screen.queryByRole("textbox", { name: "Setting name" })
    ).not.toBeInTheDocument();
    // The value is shown as text.
    expect(screen.getByText("Balls Per Game")).toBeInTheDocument();
  });

  it("(c) read-only viewer sees RichTextDisplay, not RichTextEditor, for description", () => {
    const setWithDesc: SettingsSetData = {
      ...oneSet(),
      description: SAMPLE_DOC,
    };
    render(
      <SettingsTab
        canEdit={false}
        machineId="m1"
        initialSets={[setWithDesc]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // RichTextDisplay mock is used, not the editor textarea.
    expect(screen.getByTestId("mock-display")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("(c) read-only viewer sees no DIP-bank-name input", () => {
    render(
      <SettingsTab
        canEdit={false}
        machineId="m1"
        initialSets={[dipSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    expect(
      screen.queryByRole("textbox", { name: "bank name" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Bank A")).toBeInTheDocument();
  });

  it("(c) read-only viewer sees no Edit/Save/Cancel buttons and no Add section", () => {
    render(
      <SettingsTab
        canEdit={false}
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    expect(
      screen.queryByRole("button", { name: /^Edit/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Save/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Cancel/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add section/ })
    ).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // (d) autocomplete="off" on the always-on set-name input
  // ---------------------------------------------------------------------------

  it("(d) the always-on set-name input has autocomplete='off'", () => {
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    const nameInput = screen.getByRole("textbox", { name: "set name" });
    expect(nameInput).toHaveAttribute("autocomplete", "off");
  });

  // ---------------------------------------------------------------------------
  // (e) customTitle NoteSection: editable title + body, NO Save button (bug #7)
  // ---------------------------------------------------------------------------

  it("(e) customTitle note section renders editable title and body with no Save button", async () => {
    const user = userEvent.setup();
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[
          {
            ...oneSet(),
            sections: [
              {
                id: "sec-note",
                kind: "note",
                title: "Special instructions",
                body: null,
                customTitle: true,
              },
            ],
          },
        ]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // The section title is an always-live input (customTitle=true).
    const titleInput = screen.getByRole("textbox", { name: "section title" });
    expect(titleInput).toBeInTheDocument();

    // NO Save/Edit/Cancel buttons for the section.
    expect(
      screen.queryByRole("button", {
        name: /Save the Special instructions section/,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Edit the Special instructions section/,
      })
    ).not.toBeInTheDocument();

    // Editing the title schedules an auto-save.
    await user.clear(titleInput);
    await user.type(titleInput, "Edited title");
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    const payload = saveMock.mock.calls[0]?.[0];
    const section = payload?.sections.find((s) => s.id === "sec-note");
    expect(section?.kind === "note" ? section.title : "").toBe("Edited title");
  });

  // ---------------------------------------------------------------------------
  // Section reorder (structural op) persists from working copy
  // ---------------------------------------------------------------------------

  it("Move down persists immediately from the working copy (H1)", async () => {
    const user = userEvent.setup();
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[twoNoteSet()]}
        settingsRequests={null}
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

    // A structural op flushes immediately — no debounce needed.
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    const payload = saveMock.mock.calls[0]?.[0];
    expect(payload?.sections.map((s) => s.id)).toEqual(["sec-b", "sec-a"]);
  });

  it("structural op on a never-saved set is local-only (no save fires)", async () => {
    const user = userEvent.setup();
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // New (never-saved) set; add two sections so Move down is enabled.
    fireEvent.click(screen.getByRole("button", { name: "New set" }));
    await user.click(screen.getByRole("button", { name: /Add section/ }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Post positions" })
    );
    await user.click(screen.getByRole("button", { name: /Add section/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Rubbers" }));

    await user.click(
      screen.getByRole("button", {
        name: "More options for the Post positions section",
      })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Move down" })
    );

    // Never-saved: the `if (!baseline) return` guard short-circuits persist.
    expect(saveMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // New set: first auto-save inserts (no id field)
  // ---------------------------------------------------------------------------

  it("a new set's first auto-save is an INSERT (no id field)", async () => {
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
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New set" }));
    const nameInput = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(nameInput, { target: { value: "Brand new" } });
    // Blur flushes the debounce immediately.
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    // Insert: no `id` field; name is sent.
    const payload = saveMock.mock.calls[0]?.[0];
    expect(payload?.id).toBeUndefined();
    expect(payload?.name).toBe("Brand new");
  });

  it("a blank new-set name does NOT trigger a save (required guard in execute)", async () => {
    vi.useFakeTimers();
    try {
      render(
        <SettingsTab
          canEdit
          machineId="m1"
          initialSets={[]}
          settingsRequests={null}
          settingsInstructions={null}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "New set" }));
      // The name input starts blank; blur without typing.
      const nameInput = screen.getByRole("textbox", { name: "set name" });
      fireEvent.blur(nameInput);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Empty name blocked: the execute guard sees isNew && name.trim() === "".
      expect(saveMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // Set preferred / Duplicate disabled for unsaved set
  // ---------------------------------------------------------------------------

  it("Set preferred / Duplicate are disabled for an unsaved (temp-id) set", async () => {
    const user = userEvent.setup();
    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New set" }));
    await user.click(
      screen.getByRole("button", { name: "More options for this set" })
    );

    const preferred = await screen.findByRole("menuitem", {
      name: "Set preferred",
    });
    const duplicate = screen.getByRole("menuitem", { name: "Duplicate" });
    expect(preferred).toHaveAttribute("aria-disabled", "true");
    expect(duplicate).toHaveAttribute("aria-disabled", "true");

    await user.click(preferred);
    expect(vi.mocked(setPreferredSettingsSetAction)).not.toHaveBeenCalled();
    expect(vi.mocked(duplicateSettingsSetAction)).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Nav guard: arms/disarms with hasUnsaved
  // ---------------------------------------------------------------------------

  it("nav guard arms a capturing click listener when a save is in flight", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    try {
      render(
        <SettingsTab
          canEdit
          machineId="m1"
          initialSets={[oneSet()]}
          settingsRequests={null}
          settingsInstructions={null}
        />
      );

      // Dirty the name and blur immediately to flush the save (runSave →
      // markPending → hasUnsaved = true → guard arms).
      const input = screen.getByRole("textbox", { name: "set name" });
      fireEvent.change(input, { target: { value: "Casual" } });
      fireEvent.blur(input);

      // After flush, the guard should have added its capturing click listener.
      await waitFor(() => {
        const addedCapturingClick = addSpy.mock.calls.some(
          ([type, , options]) => type === "click" && options === true
        );
        expect(addedCapturingClick).toBe(true);
      });

      // Let the save resolve successfully → guard disarms.
      await waitFor(() => {
        expect(saveMock).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        const removedCapturingClick = removeSpy.mock.calls.some(
          ([type, , options]) => type === "click" && options === true
        );
        expect(removedCapturingClick).toBe(true);
      });
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it("nav guard prompts confirm on an anchor click while a save is in flight, not when clean", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    try {
      render(
        <SettingsTab
          canEdit
          machineId="m1"
          initialSets={[oneSet()]}
          settingsRequests={null}
          settingsInstructions={null}
        />
      );

      const link = document.createElement("a");
      link.setAttribute("href", "/somewhere");
      link.textContent = "Go";
      document.body.appendChild(link);

      try {
        // Clean → clicking the anchor does NOT prompt.
        fireEvent.click(link);
        expect(confirmSpy).not.toHaveBeenCalled();

        // Dirty the name and blur to flush → runSave → markPending → guard arms.
        const input = screen.getByRole("textbox", { name: "set name" });
        fireEvent.change(input, { target: { value: "Casual" } });
        fireEvent.blur(input);

        // Wait for markPending to run (guard arms on the next render cycle).
        await waitFor(() => {
          // Clicking the link now should prompt.
          fireEvent.click(link);
          expect(confirmSpy).toHaveBeenCalledTimes(1);
        });
      } finally {
        link.remove();
      }
    } finally {
      confirmSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Atomic-commit data-loss regression (A1, from the old model — still applies
// to the new model's per-set serial queue with temp-id carry-over).
// ---------------------------------------------------------------------------

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SettingsTab — data-loss regression (A1, 🔴)", () => {
  it("persists a section edited while the new-set insert is still in flight", async () => {
    const user = userEvent.setup();

    const insertRun = deferred<{
      success: true;
      id: string;
      changed: boolean;
    }>();
    let callCount = 0;
    saveMock.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return insertRun.promise;
      return Promise.resolve({
        success: true,
        id: "server-uuid",
        changed: true,
      });
    });

    render(
      <SettingsTab
        canEdit
        machineId="m1"
        initialSets={[]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // Create a new set and name it; blur flushes to insert immediately (no
    // fake timers needed — blur triggers autoSave.flush which calls runSave).
    fireEvent.click(screen.getByRole("button", { name: "New set" }));
    const nameInput = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(nameInput, { target: { value: "Brand new" } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    // First call is the insert (no id field).
    expect(saveMock.mock.calls[0]?.[0]?.id).toBeUndefined();

    // While the insert is still in flight, add a note section and type a body.
    await user.click(screen.getByRole("button", { name: /Add section/ }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Post positions" })
    );
    // Trigger the mock editor's onChange for the note body (rich text →
    // debounce-only). Blur the name input again to flush as a proxy (the
    // set-name blur is a save flush for this set).
    const bodyEditors = screen.getAllByRole("button", {
      name: "type-in-Edit text",
    });
    const sectionBodyEditor = bodyEditors[bodyEditors.length - 1];
    if (!sectionBodyEditor) throw new Error("section body editor not rendered");
    fireEvent.click(sectionBodyEditor);
    // Blur the set name to flush the pending debounce immediately (same setId).
    fireEvent.blur(nameInput);

    // Still only the in-flight insert has hit the server (section is coalesced).
    expect(saveMock).toHaveBeenCalledTimes(1);

    // Resolve the insert → queue reruns under the real id and MUST carry the
    // section (the data-loss bug dropped it).
    await act(async () => {
      insertRun.resolve({ success: true, id: "server-uuid", changed: true });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(2);
    });

    // The second call is an UPDATE against the real id with the section's body.
    const rerunPayload = saveMock.mock.calls[1]?.[0];
    expect(rerunPayload?.id).toBe("server-uuid");
    const secA = rerunPayload?.sections.find((s) => s.kind === "note");
    expect(secA?.kind === "note" ? secA.body : null).toEqual(SAMPLE_DOC);
  });
});
