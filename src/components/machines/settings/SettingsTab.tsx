"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  SettingsSetCard,
  type SettingsSetData,
} from "~/components/machines/settings/SettingsSetCard";
import { plainTextToDoc, type ProseMirrorDoc } from "~/lib/tiptap/types";

function makeKey(): string {
  return `k-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xfff).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Hardcoded scaffold data — replaced by DB query once schema lands (PP-43q3)
// ---------------------------------------------------------------------------
function makeSampleSets(): SettingsSetData[] {
  return [
    {
      id: "set-1",
      name: "Standard House",
      isPreferred: true,
      updatedBy: "Bob",
      updatedAt: "2026-05-12",
      description: plainTextToDoc(
        "Our day-to-day setup — slightly harder than factory but accessible."
      ),
      baseline: "Competition Install",
      softwareSettings: [
        {
          _key: makeKey(),
          id: "S-001",
          name: "Replay score",
          value: "700,000,000",
        },
        { _key: makeKey(), id: "S-014", name: "Tilt warnings", value: "2" },
        { _key: makeKey(), id: "S-021", name: "Balls per game", value: "3" },
        { _key: makeKey(), id: "S-040", name: "Free play", value: "On" },
      ],
      dipSwitchBanks: [],
      notes: [
        {
          id: makeKey(),
          title: "Rubbers",
          customTitle: false,
          body: plainTextToDoc(
            '3/8" silicone on outlane posts. Leave everything else stock.'
          ),
        },
        {
          id: makeKey(),
          title: "Post positions",
          customTitle: false,
          body: plainTextToDoc(
            "Outlane posts — middle hole. Center post installed."
          ),
        },
        {
          id: makeKey(),
          title: "Notes",
          customTitle: true,
          body: plainTextToDoc(
            "Right scoop has a slight kickout issue. No impact on gameplay; just flag if it gets worse."
          ),
        },
      ],
    },
    {
      id: "set-2",
      name: "Friday Tournament",
      isPreferred: false,
      updatedBy: "Alice",
      updatedAt: "2026-05-12",
      description: plainTextToDoc(
        "Tightened for league night — tilt sensitive, no extra balls."
      ),
      baseline: "Competition Install",
      softwareSettings: [
        {
          _key: makeKey(),
          id: "S-001",
          name: "Replay score",
          value: "800,000,000",
        },
        { _key: makeKey(), id: "S-014", name: "Tilt warnings", value: "1" },
        { _key: makeKey(), id: "S-021", name: "Balls per game", value: "3" },
        {
          _key: makeKey(),
          id: "S-030",
          name: "Extra ball award",
          value: "Off",
        },
        { _key: makeKey(), id: "S-041", name: "Match feature", value: "Off" },
      ],
      dipSwitchBanks: [],
      notes: [
        {
          id: makeKey(),
          title: "Rubbers",
          customTitle: false,
          body: plainTextToDoc("Same as Standard House."),
        },
        {
          id: makeKey(),
          title: "Post positions",
          customTitle: false,
          body: plainTextToDoc("Outlane posts — top hole (tighter lane)."),
        },
        {
          id: makeKey(),
          title: "Notes",
          customTitle: true,
          body: plainTextToDoc("Review ball times after each league session."),
        },
      ],
    },
    {
      id: "set-3",
      name: "Black Knight (early SS demo)",
      isPreferred: false,
      updatedBy: "Bob",
      updatedAt: "2026-05-12",
      description: plainTextToDoc(
        "Sample early-solid-state set so you can see how DIP-switch banks render alongside no software."
      ),
      baseline: "",
      softwareSettings: [],
      dipSwitchBanks: [
        {
          id: "bank-bk-mpu",
          name: "MPU",
          switches: [
            {
              _key: makeKey(),
              switch: "DS1",
              position: "ON",
              note: "Free play",
            },
            { _key: makeKey(), switch: "DS3", position: "ON", note: "3-ball" },
            {
              _key: makeKey(),
              switch: "DS7",
              position: "OFF",
              note: "Match off",
            },
          ],
        },
        {
          id: "bank-bk-sound",
          name: "Sound",
          switches: [
            {
              _key: makeKey(),
              switch: "DS1",
              position: "OFF",
              note: "Attract music off",
            },
          ],
        },
      ],
      notes: [
        {
          id: makeKey(),
          title: "Rubbers",
          customTitle: false,
          body: plainTextToDoc("Standard outlane post rubber."),
        },
        {
          id: makeKey(),
          title: "Post positions",
          customTitle: false,
          body: plainTextToDoc("Stock."),
        },
      ],
    },
  ];
}

function makeSetId(): string {
  return `set-${Date.now().toString()}-${String(
    Math.floor(Math.random() * 1000)
  )}`;
}

interface SettingsTabProps {
  canEdit: boolean;
}

export function SettingsTab({ canEdit }: SettingsTabProps): React.JSX.Element {
  const initial = makeSampleSets();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set([initial[0]!.id])
  );
  const [sets, setSets] = useState<SettingsSetData[]>(initial);
  // Edit mode is PER SET — content editing (name, description, cells,
  // baseline, add/delete rows) unlocks only for the sets in this set.
  // Set-level operations (Duplicate, Delete, Preferred, New set) stay
  // available whenever `canEdit` (the owner/tech+ permission) is true,
  // regardless of edit mode.
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  function toggleSetEdit(id: string): void {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Entering edit mode expands the set so editable surfaces show.
        setExpandedIds((ex) => new Set(ex).add(id));
      }
      return next;
    });
  }

  function toggleExpand(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function togglePreferred(id: string): void {
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        isPreferred: s.id === id ? !s.isPreferred : false,
      }))
    );
  }

  function renameSet(id: string, name: string): void {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  function duplicateSet(id: string): void {
    setSets((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const original = prev[idx]!;
      // Deep-clone the row arrays so edits on the copy don't mutate the original.
      const copy: SettingsSetData = {
        ...original,
        id: makeSetId(),
        name: `${original.name} (copy)`,
        isPreferred: false,
        softwareSettings: original.softwareSettings.map((r) => ({
          ...r,
          _key: makeKey(),
        })),
        dipSwitchBanks: original.dipSwitchBanks.map((b) => ({
          ...b,
          id: makeKey(),
          switches: b.switches.map((sw) => ({ ...sw, _key: makeKey() })),
        })),
        notes: original.notes.map((n) => ({ ...n, id: makeKey() })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function deleteSet(id: string): void {
    setSets((prev) => prev.filter((s) => s.id !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function addNewSet(): void {
    const id = makeSetId();
    const newSet: SettingsSetData = {
      id,
      // Intentionally blank — the card opens with the name field focused and
      // required, so the owner must name it before leaving edit mode.
      name: "",
      isPreferred: false,
      updatedBy: "You",
      updatedAt: "2026-05-24",
      description: null,
      baseline: "Factory Install",
      softwareSettings: [],
      dipSwitchBanks: [],
      notes: [],
    };
    // New sets go to the top, expand, and open straight into edit mode so the
    // owner can name + fill them in without a second click.
    setSets((prev) => [newSet, ...prev]);
    setExpandedIds((prev) => new Set([...prev, id]));
    setEditingIds((prev) => new Set([...prev, id]));
  }

  function updateDescription(id: string, value: ProseMirrorDoc | null): void {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, description: value } : s))
    );
  }

  // -- Free-form note section handlers --
  function addNote(setId: string, title: string, customTitle: boolean): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              notes: [
                ...s.notes,
                { id: makeKey(), title, body: null, customTitle },
              ],
            }
          : s
      )
    );
  }

  function updateNoteTitle(setId: string, noteId: string, title: string): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              notes: s.notes.map((n) =>
                n.id === noteId ? { ...n, title } : n
              ),
            }
          : s
      )
    );
  }

  function updateNoteBody(
    setId: string,
    noteId: string,
    body: ProseMirrorDoc | null
  ): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              notes: s.notes.map((n) => (n.id === noteId ? { ...n, body } : n)),
            }
          : s
      )
    );
  }

  function deleteNote(setId: string, noteId: string): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? { ...s, notes: s.notes.filter((n) => n.id !== noteId) }
          : s
      )
    );
  }

  function updateBaseline(id: string, baseline: string): void {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, baseline } : s)));
  }

  // -- Software-settings row handlers --
  function addSoftwareRow(setId: string): string {
    const newKey = makeKey();
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              softwareSettings: [
                ...s.softwareSettings,
                { _key: newKey, id: "", name: "", value: "" },
              ],
            }
          : s
      )
    );
    return newKey;
  }

  function updateSoftwareRow(
    setId: string,
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              softwareSettings: s.softwareSettings.map((r) =>
                r._key === rowKey ? { ...r, [field]: value } : r
              ),
            }
          : s
      )
    );
  }

  function deleteSoftwareRow(setId: string, rowKey: string): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              softwareSettings: s.softwareSettings.filter(
                (r) => r._key !== rowKey
              ),
            }
          : s
      )
    );
  }

  // -- DIP switch handlers --
  function addDipBank(setId: string): {
    bankId: string;
    switchKey: string;
  } {
    const bankId = makeKey();
    const switchKey = makeKey();
    setSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId) return s;
        const num = s.dipSwitchBanks.length + 1;
        return {
          ...s,
          dipSwitchBanks: [
            ...s.dipSwitchBanks,
            {
              id: bankId,
              name: `Bank ${String(num)}`,
              switches: [
                { _key: switchKey, switch: "", position: "OFF", note: "" },
              ],
            },
          ],
        };
      })
    );
    return { bankId, switchKey };
  }

  function deleteDipBank(setId: string, bankId: string): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              dipSwitchBanks: s.dipSwitchBanks.filter((b) => b.id !== bankId),
            }
          : s
      )
    );
  }

  function renameDipBank(setId: string, bankId: string, name: string): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              dipSwitchBanks: s.dipSwitchBanks.map((b) =>
                b.id === bankId ? { ...b, name } : b
              ),
            }
          : s
      )
    );
  }

  function addDipSwitch(setId: string, bankId: string): string {
    const newKey = makeKey();
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              dipSwitchBanks: s.dipSwitchBanks.map((b) =>
                b.id === bankId
                  ? {
                      ...b,
                      switches: [
                        ...b.switches,
                        { _key: newKey, switch: "", position: "OFF", note: "" },
                      ],
                    }
                  : b
              ),
            }
          : s
      )
    );
    return newKey;
  }

  function updateDipSwitch(
    setId: string,
    bankId: string,
    switchKey: string,
    field: "switch" | "position" | "note",
    value: string
  ): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              dipSwitchBanks: s.dipSwitchBanks.map((b) =>
                b.id === bankId
                  ? {
                      ...b,
                      switches: b.switches.map((sw) =>
                        sw._key === switchKey ? { ...sw, [field]: value } : sw
                      ),
                    }
                  : b
              ),
            }
          : s
      )
    );
  }

  function deleteDipSwitch(
    setId: string,
    bankId: string,
    switchKey: string
  ): void {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              dipSwitchBanks: s.dipSwitchBanks.map((b) =>
                b.id === bankId
                  ? {
                      ...b,
                      switches: b.switches.filter(
                        (sw) => sw._key !== switchKey
                      ),
                    }
                  : b
              ),
            }
          : s
      )
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Game settings{" "}
          <span className="text-muted-foreground">
            · {String(sets.length)} set{sets.length !== 1 ? "s" : ""}
          </span>
        </p>
        {canEdit && (
          <Button size="sm" onClick={addNewSet}>
            <Plus aria-hidden="true" />
            New set
          </Button>
        )}
      </div>

      {sets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant py-8 text-center text-sm text-muted-foreground">
          {canEdit ? (
            <>
              No settings sets yet. Click <strong>New set</strong> above to
              create one.
            </>
          ) : (
            "No settings sets recorded."
          )}
        </p>
      ) : (
        <div className="space-y-3">
          {sets.map((set) => (
            <SettingsSetCard
              key={set.id}
              set={set}
              isExpanded={expandedIds.has(set.id)}
              canEdit={canEdit}
              isEditing={editingIds.has(set.id)}
              onToggleExpand={() => {
                toggleExpand(set.id);
              }}
              onToggleEdit={() => {
                toggleSetEdit(set.id);
              }}
              onTogglePreferred={() => {
                togglePreferred(set.id);
              }}
              onRename={(name) => {
                renameSet(set.id, name);
              }}
              onDuplicate={() => {
                duplicateSet(set.id);
              }}
              onDelete={() => {
                deleteSet(set.id);
              }}
              onUpdateDescription={(value) => {
                updateDescription(set.id, value);
              }}
              onUpdateBaseline={(baseline) => {
                updateBaseline(set.id, baseline);
              }}
              onAddSoftwareRow={() => addSoftwareRow(set.id)}
              onUpdateSoftwareRow={(rowKey, field, value) => {
                updateSoftwareRow(set.id, rowKey, field, value);
              }}
              onDeleteSoftwareRow={(rowKey) => {
                deleteSoftwareRow(set.id, rowKey);
              }}
              onAddDipBank={() => addDipBank(set.id)}
              onDeleteDipBank={(bankId) => {
                deleteDipBank(set.id, bankId);
              }}
              onRenameDipBank={(bankId, name) => {
                renameDipBank(set.id, bankId, name);
              }}
              onAddDipSwitch={(bankId) => addDipSwitch(set.id, bankId)}
              onUpdateDipSwitch={(bankId, switchKey, field, value) => {
                updateDipSwitch(set.id, bankId, switchKey, field, value);
              }}
              onDeleteDipSwitch={(bankId, switchKey) => {
                deleteDipSwitch(set.id, bankId, switchKey);
              }}
              onAddNote={(title, customTitle) => {
                addNote(set.id, title, customTitle);
              }}
              onUpdateNoteTitle={(noteId, title) => {
                updateNoteTitle(set.id, noteId, title);
              }}
              onUpdateNoteBody={(noteId, body) => {
                updateNoteBody(set.id, noteId, body);
              }}
              onDeleteNote={(noteId) => {
                deleteNote(set.id, noteId);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
