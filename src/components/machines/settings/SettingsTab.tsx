"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  SettingsSetCard,
  type SettingsSetData,
  type MarkdownField,
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
      baseline: "Stern__Competition Install",
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
      rubbers: plainTextToDoc(
        '3/8" silicone on outlane posts. Leave everything else stock.'
      ),
      postPositions: plainTextToDoc(
        "Outlane posts — middle hole. Center post installed."
      ),
      notes: plainTextToDoc(
        "Right scoop has a slight kickout issue. No impact on gameplay; just flag if it gets worse."
      ),
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
      baseline: "Stern__Competition Install",
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
      rubbers: plainTextToDoc("Same as Standard House."),
      postPositions: plainTextToDoc("Outlane posts — top hole (tighter lane)."),
      notes: plainTextToDoc("Review ball times after each league session."),
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
      baseline: "Other...",
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
      rubbers: plainTextToDoc("Standard outlane post rubber."),
      postPositions: plainTextToDoc("Stock."),
      notes: null,
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
      name: "New settings set",
      isPreferred: false,
      updatedBy: "You",
      updatedAt: "2026-05-19",
      description: null,
      baseline: "Stern__Factory Install",
      softwareSettings: [],
      dipSwitchBanks: [],
      rubbers: null,
      postPositions: null,
      notes: null,
    };
    setSets((prev) => [...prev, newSet]);
    setExpandedIds((prev) => new Set([...prev, id]));
  }

  function updateMarkdownField(
    id: string,
    field: MarkdownField,
    value: ProseMirrorDoc | null
  ): void {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
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
          No settings sets yet. Click <strong>New set</strong> above to create
          one.
        </p>
      ) : (
        <div className="space-y-3">
          {sets.map((set) => (
            <SettingsSetCard
              key={set.id}
              set={set}
              isExpanded={expandedIds.has(set.id)}
              canEdit={canEdit}
              onToggleExpand={() => {
                toggleExpand(set.id);
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
              onUpdateField={(field, value) => {
                updateMarkdownField(set.id, field, value);
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
              onAddDipSwitch={(bankId) => addDipSwitch(set.id, bankId)}
              onUpdateDipSwitch={(bankId, switchKey, field, value) => {
                updateDipSwitch(set.id, bankId, switchKey, field, value);
              }}
              onDeleteDipSwitch={(bankId, switchKey) => {
                deleteDipSwitch(set.id, bankId, switchKey);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
