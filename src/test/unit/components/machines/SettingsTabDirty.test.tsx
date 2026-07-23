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
import { type ReactNode } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

import { SettingsTab } from "~/components/machines/settings/SettingsTab";
import {
  duplicateSettingsSetAction,
  saveSettingsSetAction,
  setPreferredSettingsSetAction,
  updateMachineSettingsRequestsAction,
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
    onBlur,
  }: {
    ariaLabel?: string;
    onChange?: (doc: ProseMirrorDoc) => void;
    onBlur?: () => void;
  }) => (
    <div>
      <textarea
        aria-label={ariaLabel}
        onBlur={() => {
          onBlur?.();
        }}
      />
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
  setTournamentTagAction: vi.fn(),
  publishSettingsSetAction: vi.fn(),
  updateMachineSettingsInstructionsAction: vi.fn(),
  updateMachineSettingsRequestsAction: vi.fn(),
}));

// The badges use shadcn Tooltip, which needs a TooltipProvider ancestor the
// bare render() lacks. Render tooltip parts as pass-throughs (their text isn't
// asserted here).
vi.mock("~/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: () => null,
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

// Shared defaults for the sharing/visibility fields (PP-tn6t). Tests that care
// about read-only rendering pass `{ canEdit: false }`.
function setDefaults(): Pick<
  SettingsSetData,
  | "isOwnerSet"
  | "isPublic"
  | "isTournament"
  | "createdById"
  | "canEdit"
  | "canSetDefault"
> {
  return {
    isOwnerSet: false,
    isPublic: true,
    isTournament: false,
    createdById: "u1",
    canEdit: true,
    canSetDefault: false,
  };
}

function oneSet(over: Partial<SettingsSetData> = {}): SettingsSetData {
  return {
    id: "set-1",
    name: "Comp rules",
    isPreferred: false,
    ...setDefaults(),
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
    ...over,
  };
}

function twoNoteSet(over: Partial<SettingsSetData> = {}): SettingsSetData {
  return {
    id: "set-1",
    name: "Comp rules",
    isPreferred: false,
    ...setDefaults(),
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
    ...over,
  };
}

function dipSet(over: Partial<SettingsSetData> = {}): SettingsSetData {
  return {
    id: "set-1",
    name: "Comp rules",
    isPreferred: false,
    ...setDefaults(),
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
    ...over,
  };
}

// ---------------------------------------------------------------------------
// (a) Permitted user: always-live inputs, no "Edit" gating
// ---------------------------------------------------------------------------

describe("SettingsTab — always-live auto-save model (PP-43q3 pivot)", () => {
  it("(a) a permitted user sees the set-name input immediately — no Edit button", () => {
    render(
      <SettingsTab
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // Cards render collapsed by default (PP-tn6t) — expand to reach the body.
    fireEvent.click(
      screen.getByRole("button", { name: /Comp rules settings set/ })
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
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
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
        canCreate={false}
        viewerId="u2"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[oneSet({ canEdit: false })]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // No inputs for the set name.
    expect(
      screen.queryByRole("textbox", { name: "set name" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Comp rules")).toBeInTheDocument();
  });

  it("(c) read-only viewer sees no table-cell inputs — only plain spans", () => {
    render(
      <SettingsTab
        canCreate={false}
        viewerId="u2"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[oneSet({ canEdit: false })]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // Cards render collapsed by default (PP-tn6t) — expand to reach the body.
    fireEvent.click(
      screen.getByRole("button", { name: /Comp rules settings set/ })
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
      ...oneSet({ canEdit: false }),
      description: SAMPLE_DOC,
    };
    render(
      <SettingsTab
        canCreate={false}
        viewerId="u2"
        machineOwnerId="u1"
        ownerName="Owner"
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
        canCreate={false}
        viewerId="u2"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[dipSet({ canEdit: false })]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // Cards render collapsed by default (PP-tn6t) — expand to reach the body.
    fireEvent.click(
      screen.getByRole("button", { name: /Comp rules settings set/ })
    );

    expect(
      screen.queryByRole("textbox", { name: "bank name" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Bank A")).toBeInTheDocument();
  });

  it("(c) read-only viewer sees no Edit/Save/Cancel buttons and no Add section", () => {
    render(
      <SettingsTab
        canCreate={false}
        viewerId="u2"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[oneSet({ canEdit: false })]}
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
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

    // Cards render collapsed by default (PP-tn6t) — expand to reach the body.
    fireEvent.click(
      screen.getByRole("button", { name: /Comp rules settings set/ })
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[twoNoteSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // Cards render collapsed by default (PP-tn6t) — expand to reach the body.
    fireEvent.click(
      screen.getByRole("button", { name: /Comp rules settings set/ })
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
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

  it("(dirty) new set's insert clears dirty under the temp id — guard disarms (no temp-id leak)", async () => {
    saveMock.mockResolvedValue({
      success: true,
      id: "server-uuid",
      changed: true,
    });
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
          machineId="m1"
          initialSets={[]}
          settingsRequests={null}
          settingsInstructions={null}
        />
      );

      const link = document.createElement("a");
      link.setAttribute("href", "/somewhere");
      link.textContent = "Go";
      document.body.appendChild(link);

      try {
        // Create a new set, name it, blur to flush the INSERT immediately.
        fireEvent.click(screen.getByRole("button", { name: "New set" }));
        const nameInput = screen.getByRole("textbox", { name: "set name" });
        fireEvent.change(nameInput, { target: { value: "Brand new" } });
        fireEvent.blur(nameInput);

        await waitFor(() => {
          expect(saveMock).toHaveBeenCalledTimes(1);
        });
        // Drain the markSaved + markClean/markDirty state updates.
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        // Reset the spy so guard-armed clicks during the insert don't
        // contaminate the post-save assertion.
        confirmSpy.mockClear();

        // After the new set's insert resolves cleanly, the dirty signal keyed
        // under the temp id must be cleared (rekeyed temp→real), so the guard
        // is DISARMED. A leak of the temp id keeps hasUnsaved=true forever.
        fireEvent.click(link);
        expect(confirmSpy).not.toHaveBeenCalled();
      } finally {
        link.remove();
      }
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("a blank new-set name does NOT trigger a save (required guard in execute)", async () => {
    vi.useFakeTimers();
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
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

    // The new set is the owner's first, so it is optimistically the Owner's
    // default — the menu item reads "Unset owner's default". Both it and
    // Duplicate act on a persisted row, so they're disabled until first save.
    const ownerDefault = await screen.findByRole("menuitem", {
      name: /owner's default/i,
    });
    const duplicate = screen.getByRole("menuitem", { name: "Duplicate" });
    expect(ownerDefault).toHaveAttribute("aria-disabled", "true");
    expect(duplicate).toHaveAttribute("aria-disabled", "true");

    await user.click(ownerDefault);
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
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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

  it("nav guard does NOT prompt on an anchor click while a save is merely in flight (pending, not failed) — it flushes silently", async () => {
    // Hold the save open so the set stays in the PENDING state across the click.
    const inflight = deferred<{
      success: true;
      id: string;
      changed: boolean;
    }>();
    saveMock.mockReturnValue(inflight.promise);
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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

        // Dirty the name and blur to flush → runSave → markPending → pending.
        const input = screen.getByRole("textbox", { name: "set name" });
        fireEvent.change(input, { target: { value: "Casual" } });
        fireEvent.blur(input);

        // The save is in flight (held open). Pending — NOT failed.
        await waitFor(() => {
          expect(saveMock).toHaveBeenCalledTimes(1);
        });
        await act(async () => {
          await Promise.resolve();
        });

        // Clicking the link now must NOT prompt (pending is recoverable: the
        // in-flight server action completes after the tab unmounts).
        fireEvent.click(link);
        expect(confirmSpy).not.toHaveBeenCalled();
      } finally {
        link.remove();
        inflight.resolve({ success: true, id: "set-1", changed: true });
      }
    } finally {
      confirmSpy.mockRestore();
    }
  });
  // ---------------------------------------------------------------------------
  // Task 8: reactive dirty signal — guard arms on first keystroke (PP-43q3)
  // ---------------------------------------------------------------------------

  it("(dirty) a link click right after a keystroke (dirty, no failure) does NOT prompt but flushes the pending save", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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
        // Type a single character — editSet calls markDirty, so hasUnsaved is
        // true immediately, BEFORE any blur/flush. The 800 ms debounce has NOT
        // fired, so nothing has hit the server yet.
        const input = screen.getByRole("textbox", { name: "set name" });
        fireEvent.change(input, { target: { value: "C" } });
        expect(saveMock).not.toHaveBeenCalled();

        // Let the markDirty state update settle.
        await act(async () => {
          await Promise.resolve();
        });

        // Clicking the link must NOT prompt (dirty, not failed) and must FLUSH
        // the pending debounce so the edit persists silently on the way out.
        fireEvent.click(link);
        expect(confirmSpy).not.toHaveBeenCalled();

        await waitFor(() => {
          expect(saveMock).toHaveBeenCalledTimes(1);
        });
        expect(saveMock).toHaveBeenCalledWith(
          expect.objectContaining({ name: "C" })
        );
      } finally {
        link.remove();
      }
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("(dirty) guard disarms after a successful save clears dirty", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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
        // Type and blur → editSet marks dirty; blur flushes → save fires.
        const input = screen.getByRole("textbox", { name: "set name" });
        fireEvent.change(input, { target: { value: "Casual" } });
        fireEvent.blur(input);

        // Wait for the save to complete (markSaved + markClean → hasUnsaved=false).
        await waitFor(() => {
          expect(saveMock).toHaveBeenCalledTimes(1);
        });
        // Let React drain the markSaved + markClean state updates.
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        // Reset the spy call count so any guard-armed clicks during the save
        // don't contaminate the post-save assertion.
        confirmSpy.mockClear();

        // After the save resolves cleanly, the guard should have disarmed.
        fireEvent.click(link);
        expect(confirmSpy).not.toHaveBeenCalled();
      } finally {
        link.remove();
      }
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("(failed) guard PROMPTS on a link click after a save FAILED, and cancel blocks navigation", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    saveMock.mockResolvedValue({
      success: false,
      error: "Network error",
    });
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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
        const input = screen.getByRole("textbox", { name: "set name" });
        fireEvent.change(input, { target: { value: "Casual" } });
        fireEvent.blur(input);

        // Wait for the failed save to settle (markFailed fires).
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        // A FAILED save is the one prompt case: clicking a link must call
        // window.confirm with the failed-save copy, and (cancel → false) must
        // block navigation by preventing the click default.
        const blocked = fireEvent.click(link);
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(confirmSpy).toHaveBeenCalledWith(
          "A settings change failed to save. Leave and lose it?"
        );
        // fireEvent.click returns false when a handler called preventDefault.
        expect(blocked).toBe(false);
      } finally {
        link.remove();
      }
    } finally {
      confirmSpy.mockRestore();
    }
  });

  // ---------------------------------------------------------------------------
  // Task 11: machine-level explicit-save drafts arm the nav guard (PP-8a5r)
  //
  // The two machine-level InlineEditableField sections use EXPLICIT Save/Cancel,
  // not the auto-save machinery. A dirty draft there has nothing to flush, so
  // leaving with it must PROMPT (like a failed save). After Save (dirty→clean)
  // the prompt is gone.
  // ---------------------------------------------------------------------------

  it("(draft) a dirty machine-field draft PROMPTS on a link click, and cancel blocks navigation", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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

        // Dirty the "Before you change anything" machine-level draft via the
        // mock editor's onChange button (the field's ariaLabel is its label).
        fireEvent.click(
          screen.getByRole("button", {
            name: "type-in-Before you change anything",
          })
        );

        // Let the onDirtyChange effect propagate (markdirty → hasUnsavedDraft).
        await act(async () => {
          await Promise.resolve();
        });

        // Now clicking the link must PROMPT with the generic unsaved-changes
        // copy, and cancel (→ false) must block navigation (preventDefault).
        const blocked = fireEvent.click(link);
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(confirmSpy).toHaveBeenCalledWith(
          "You have unsaved changes. Leave without saving?"
        );
        expect(blocked).toBe(false);
      } finally {
        link.remove();
      }
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("(draft) after Save the machine-field draft is clean → link click does NOT prompt", async () => {
    const updateRequests = vi.mocked(updateMachineSettingsRequestsAction);
    updateRequests.mockResolvedValue({ success: true });
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
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
        // Dirty the draft.
        fireEvent.click(
          screen.getByRole("button", {
            name: "type-in-Before you change anything",
          })
        );
        await act(async () => {
          await Promise.resolve();
        });

        // Save the draft → onSave resolves ok → field clears dirty → guard
        // disarms for this draft.
        fireEvent.click(screen.getByTestId("machine-settings-requests-save"));
        await waitFor(() => {
          expect(updateRequests).toHaveBeenCalledTimes(1);
        });
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        confirmSpy.mockClear();

        // Clean again → clicking the link must NOT prompt.
        fireEvent.click(link);
        expect(confirmSpy).not.toHaveBeenCalled();
      } finally {
        link.remove();
      }
    } finally {
      confirmSpy.mockRestore();
    }
  });

  // ---------------------------------------------------------------------------
  // Task 9: durability — flush on nav/popstate/unmount; rich-text onBlur flush
  // ---------------------------------------------------------------------------

  it("(popstate) browser back/forward with unsaved edits flushes the pending save (no prompt)", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
          machineId="m1"
          initialSets={[oneSet()]}
          settingsRequests={null}
          settingsInstructions={null}
        />
      );

      // Dirty the name (markDirty → hasUnsaved). Debounce has NOT fired yet.
      const input = screen.getByRole("textbox", { name: "set name" });
      fireEvent.change(input, { target: { value: "Casual" } });
      expect(saveMock).not.toHaveBeenCalled();

      await act(async () => {
        await Promise.resolve();
      });

      // A popstate (back/forward) must flush the pending debounce, with no
      // prompt — there is no synchronous way to block popstate, so flush is the
      // protection.
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      await waitFor(() => {
        expect(saveMock).toHaveBeenCalledTimes(1);
      });
      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Casual" })
      );
      expect(confirmSpy).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("(unmount) unmounting the tab with a pending debounce flushes it (the edit persists)", async () => {
    const { unmount } = render(
      <SettingsTab
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // Dirty the name; the 800 ms debounce is still pending (not fired).
    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Casual" } });
    expect(saveMock).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.resolve();
    });

    // Unmount (in-app soft navigation away from the tab). The flush-on-unmount
    // effect must flush the pending debounce so the edit is not dropped.
    act(() => {
      unmount();
    });

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Casual" })
    );
  });

  it("(rich-text onBlur) blurring the description editor flushes that set's save", async () => {
    const setWithDescOpen: SettingsSetData = { ...oneSet() };
    render(
      <SettingsTab
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[setWithDescOpen]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // The description is click-to-edit (PP-tn6t): open the editor first.
    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));

    // Edit the description via the mock editor's onChange (markDirty + schedule,
    // debounce pending). Then blur the editor → onBlur → flush.
    const descEditor = screen.getByRole("button", {
      name: "type-in-Edit text",
    });
    fireEvent.click(descEditor);
    expect(saveMock).not.toHaveBeenCalled();

    // Blur the description editor's textarea → onBlur fires → autoSave.flush.
    const descTextarea = screen.getByRole("textbox", { name: "Edit text" });
    fireEvent.blur(descTextarea);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    const payload = saveMock.mock.calls[0]?.[0];
    expect(payload?.description).toEqual(SAMPLE_DOC);
  });

  it("(failed + popstate) a FAILED save is re-persisted on popstate (no timer, no prompt)", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    // First save FAILS (puts the set into failedIds, no live timer).
    saveMock.mockResolvedValueOnce({ success: false, error: "Network error" });
    try {
      render(
        <SettingsTab
          canCreate
          viewerId="u1"
          machineOwnerId="u1"
          ownerName="Owner"
          machineId="m1"
          initialSets={[oneSet()]}
          settingsRequests={null}
          settingsInstructions={null}
        />
      );

      // Edit + blur → flush → save fires → fails. The debounce timer is gone
      // (flush cancelled it), so the set sits in failedIds/dirtyIds with NO
      // timer — exactly the case flushAll() (timer-only) would have missed.
      const input = screen.getByRole("textbox", { name: "set name" });
      fireEvent.change(input, { target: { value: "Casual" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(saveMock).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // popstate (back/forward) must re-persist the failed set from save-status,
      // not from the (empty) timer map — and must NOT prompt.
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      await waitFor(() => {
        expect(saveMock).toHaveBeenCalledTimes(2);
      });
      expect(saveMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "Casual" })
      );
      expect(confirmSpy).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("(failed + unmount) a FAILED save is re-persisted on unmount (no timer)", async () => {
    saveMock.mockResolvedValueOnce({ success: false, error: "Network error" });
    const { unmount } = render(
      <SettingsTab
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
        machineId="m1"
        initialSets={[oneSet()]}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    const input = screen.getByRole("textbox", { name: "set name" });
    fireEvent.change(input, { target: { value: "Casual" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Non-anchor unmount (e.g. switching machine tabs — the capturing click
    // listener only catches <a>). The leaving-flush must re-persist the failed
    // set from save-status even though it has no live debounce timer.
    act(() => {
      unmount();
    });

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(2);
    });
    expect(saveMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Casual" })
    );
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
        canCreate
        viewerId="u1"
        machineOwnerId="u1"
        ownerName="Owner"
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

// ---------------------------------------------------------------------------
// Category filter chip counts (PP-tn6t) — "Owner's" and "Community" are KINDS
// and must partition "All" regardless of visibility. Regression: a community
// PRIVATE draft used to fall out of the Community count (isPublic gate), so the
// chips didn't sum to All.
// ---------------------------------------------------------------------------

describe("SettingsTab — category chip counts partition by kind", () => {
  it("Owner's + Community counts sum to All, including private drafts of each kind", () => {
    // A viewer who is neither the owner nor any set's creator: "Owner's" shows
    // (viewer isn't the owner) and "Mine" hides (0 authored), so the two kind
    // chips are the whole partition.
    const sets: SettingsSetData[] = [
      oneSet({
        id: "owner-public",
        isOwnerSet: true,
        isPublic: true,
        createdById: "owner-y",
      }),
      oneSet({
        id: "owner-draft",
        isOwnerSet: true,
        isPublic: false, // owner private draft
        createdById: "owner-y",
      }),
      oneSet({
        id: "community-public",
        isOwnerSet: false,
        isPublic: true,
        createdById: "tech-z",
      }),
      oneSet({
        id: "community-draft",
        isOwnerSet: false,
        isPublic: false, // community private draft — the regression case
        createdById: "tech-z",
      }),
    ];

    render(
      <SettingsTab
        canCreate
        viewerId="viewer-x"
        machineOwnerId="owner-y"
        ownerName="Owner"
        machineId="m1"
        initialSets={sets}
        settingsRequests={null}
        settingsInstructions={null}
      />
    );

    // Chips read "<label> <count>"; both kinds count their private drafts, so
    // Owner's 2 + Community 2 = All 4.
    expect(screen.getByRole("button", { name: /^All 4$/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Owner's 2$/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Community 2$/ })
    ).toBeInTheDocument();
  });
});
