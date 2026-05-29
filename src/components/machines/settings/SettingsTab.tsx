"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "~/components/ui/button";
import {
  SettingsSetCard,
  type AddSectionSpec,
  type Section,
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
      sections: [
        {
          id: makeKey(),
          kind: "software",
          baseline: "Competition Install",
          rows: [
            {
              _key: makeKey(),
              id: "S-001",
              name: "Replay score",
              value: "700,000,000",
            },
            { _key: makeKey(), id: "S-014", name: "Tilt warnings", value: "2" },
            {
              _key: makeKey(),
              id: "S-021",
              name: "Balls per game",
              value: "3",
            },
            { _key: makeKey(), id: "S-040", name: "Free play", value: "On" },
          ],
        },
        {
          id: makeKey(),
          kind: "note",
          title: "Rubbers",
          customTitle: false,
          body: plainTextToDoc(
            '3/8" silicone on outlane posts. Leave everything else stock.'
          ),
        },
        {
          id: makeKey(),
          kind: "note",
          title: "Post positions",
          customTitle: false,
          body: plainTextToDoc(
            "Outlane posts — middle hole. Center post installed."
          ),
        },
        {
          id: makeKey(),
          kind: "note",
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
      sections: [
        {
          id: makeKey(),
          kind: "software",
          baseline: "Competition Install",
          rows: [
            {
              _key: makeKey(),
              id: "S-001",
              name: "Replay score",
              value: "800,000,000",
            },
            { _key: makeKey(), id: "S-014", name: "Tilt warnings", value: "1" },
            {
              _key: makeKey(),
              id: "S-021",
              name: "Balls per game",
              value: "3",
            },
            {
              _key: makeKey(),
              id: "S-030",
              name: "Extra ball award",
              value: "Off",
            },
            {
              _key: makeKey(),
              id: "S-041",
              name: "Match feature",
              value: "Off",
            },
          ],
        },
        {
          id: makeKey(),
          kind: "note",
          title: "Rubbers",
          customTitle: false,
          body: plainTextToDoc("Same as Standard House."),
        },
        {
          id: makeKey(),
          kind: "note",
          title: "Post positions",
          customTitle: false,
          body: plainTextToDoc("Outlane posts — top hole (tighter lane)."),
        },
        {
          id: makeKey(),
          kind: "note",
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
      sections: [
        {
          id: makeKey(),
          kind: "dip",
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
          id: makeKey(),
          kind: "dip",
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
        {
          id: makeKey(),
          kind: "note",
          title: "Rubbers",
          customTitle: false,
          body: plainTextToDoc("Standard outlane post rubber."),
        },
        {
          id: makeKey(),
          kind: "note",
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
  // Edit mode is PER SET — content editing unlocks only for the sets in this
  // set. Set-level operations (Duplicate, Delete, Preferred, New set) stay
  // available whenever `canEdit` (the owner/tech+ permission) is true.
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  // The preferred set is always pinned to the top. A stable sort preserves the
  // insertion order of everything else (new sets, etc.).
  const orderedSets = [...sets].sort(
    (a, b) => Number(b.isPreferred) - Number(a.isPreferred)
  );

  function toggleSetEdit(id: string): void {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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
      // Deep-clone every section (and its inner rows/switches) so edits on the
      // copy don't mutate the original.
      const copy: SettingsSetData = {
        ...original,
        id: makeSetId(),
        name: `${original.name} (copy)`,
        isPreferred: false,
        sections: original.sections.map(cloneSection),
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
      updatedAt: "2026-05-25",
      description: null,
      sections: [],
    };
    // New sets go to the top, expand, and open straight into edit mode.
    setSets((prev) => [newSet, ...prev]);
    setExpandedIds((prev) => new Set([...prev, id]));
    setEditingIds((prev) => new Set([...prev, id]));
  }

  function updateDescription(id: string, value: ProseMirrorDoc | null): void {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, description: value } : s))
    );
  }

  // -- Section-level operations --
  function mapSections(
    setId: string,
    fn: (sections: Section[]) => Section[]
  ): void {
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, sections: fn(s.sections) } : s))
    );
  }

  function updateSection(
    setId: string,
    sectionId: string,
    updater: (section: Section) => Section
  ): void {
    mapSections(setId, (sections) =>
      sections.map((sec) => (sec.id === sectionId ? updater(sec) : sec))
    );
  }

  function addSection(setId: string, spec: AddSectionSpec): void {
    setSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId) return s;
        let section: Section;
        if (spec.kind === "software") {
          section = {
            id: makeKey(),
            kind: "software",
            baseline: "Factory Install",
            rows: [{ _key: makeKey(), id: "", name: "", value: "" }],
          };
        } else if (spec.kind === "dip") {
          const num = s.sections.filter((x) => x.kind === "dip").length + 1;
          section = {
            id: makeKey(),
            kind: "dip",
            name: `Bank ${String(num)}`,
            switches: [
              { _key: makeKey(), switch: "", position: "OFF", note: "" },
            ],
          };
        } else {
          section = {
            id: makeKey(),
            kind: "note",
            title: spec.title,
            body: null,
            customTitle: spec.customTitle,
          };
        }
        return { ...s, sections: [...s.sections, section] };
      })
    );
  }

  function deleteSection(setId: string, sectionId: string): void {
    mapSections(setId, (sections) =>
      sections.filter((sec) => sec.id !== sectionId)
    );
  }

  function reorderSections(
    setId: string,
    activeId: string,
    overId: string
  ): void {
    mapSections(setId, (sections) => {
      const oldIndex = sections.findIndex((sec) => sec.id === activeId);
      const newIndex = sections.findIndex((sec) => sec.id === overId);
      if (oldIndex < 0 || newIndex < 0) return sections;
      return arrayMove(sections, oldIndex, newIndex);
    });
  }

  // -- Software-settings row handlers (scoped to a software section) --
  function updateBaseline(
    setId: string,
    sectionId: string,
    baseline: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "software" ? { ...sec, baseline } : sec
    );
  }

  function addSoftwareRow(setId: string, sectionId: string): string {
    const newKey = makeKey();
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "software"
        ? {
            ...sec,
            rows: [...sec.rows, { _key: newKey, id: "", name: "", value: "" }],
          }
        : sec
    );
    return newKey;
  }

  function updateSoftwareRow(
    setId: string,
    sectionId: string,
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "software"
        ? {
            ...sec,
            rows: sec.rows.map((r) =>
              r._key === rowKey ? { ...r, [field]: value } : r
            ),
          }
        : sec
    );
  }

  function deleteSoftwareRow(
    setId: string,
    sectionId: string,
    rowKey: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "software"
        ? { ...sec, rows: sec.rows.filter((r) => r._key !== rowKey) }
        : sec
    );
  }

  // -- DIP switch handlers (scoped to a dip section) --
  function renameDipBank(setId: string, sectionId: string, name: string): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "dip" ? { ...sec, name } : sec
    );
  }

  function addDipSwitch(setId: string, sectionId: string): string {
    const newKey = makeKey();
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "dip"
        ? {
            ...sec,
            switches: [
              ...sec.switches,
              { _key: newKey, switch: "", position: "OFF", note: "" },
            ],
          }
        : sec
    );
    return newKey;
  }

  function updateDipSwitch(
    setId: string,
    sectionId: string,
    switchKey: string,
    field: "switch" | "position" | "note",
    value: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "dip"
        ? {
            ...sec,
            switches: sec.switches.map((sw) =>
              sw._key === switchKey ? { ...sw, [field]: value } : sw
            ),
          }
        : sec
    );
  }

  function deleteDipSwitch(
    setId: string,
    sectionId: string,
    switchKey: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "dip"
        ? {
            ...sec,
            switches: sec.switches.filter((sw) => sw._key !== switchKey),
          }
        : sec
    );
  }

  // -- Free-form note section handlers (scoped to a note section) --
  function updateNoteTitle(
    setId: string,
    sectionId: string,
    title: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "note" ? { ...sec, title } : sec
    );
  }

  function updateNoteBody(
    setId: string,
    sectionId: string,
    body: ProseMirrorDoc | null
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "note" ? { ...sec, body } : sec
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
          {orderedSets.map((set) => (
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
              onAddSection={(spec) => {
                addSection(set.id, spec);
              }}
              onDeleteSection={(sectionId) => {
                deleteSection(set.id, sectionId);
              }}
              onReorderSections={(activeId, overId) => {
                reorderSections(set.id, activeId, overId);
              }}
              onUpdateBaseline={(sectionId, value) => {
                updateBaseline(set.id, sectionId, value);
              }}
              onAddSoftwareRow={(sectionId) =>
                addSoftwareRow(set.id, sectionId)
              }
              onUpdateSoftwareRow={(sectionId, rowKey, field, value) => {
                updateSoftwareRow(set.id, sectionId, rowKey, field, value);
              }}
              onDeleteSoftwareRow={(sectionId, rowKey) => {
                deleteSoftwareRow(set.id, sectionId, rowKey);
              }}
              onRenameDipBank={(sectionId, name) => {
                renameDipBank(set.id, sectionId, name);
              }}
              onAddDipSwitch={(sectionId) => addDipSwitch(set.id, sectionId)}
              onUpdateDipSwitch={(sectionId, switchKey, field, value) => {
                updateDipSwitch(set.id, sectionId, switchKey, field, value);
              }}
              onDeleteDipSwitch={(sectionId, switchKey) => {
                deleteDipSwitch(set.id, sectionId, switchKey);
              }}
              onUpdateNoteTitle={(sectionId, title) => {
                updateNoteTitle(set.id, sectionId, title);
              }}
              onUpdateNoteBody={(sectionId, body) => {
                updateNoteBody(set.id, sectionId, body);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Deep-clone one section, regenerating every key/id so the copy is isolated. */
function cloneSection(section: Section): Section {
  switch (section.kind) {
    case "software":
      return {
        ...section,
        id: makeKey(),
        rows: section.rows.map((r) => ({ ...r, _key: makeKey() })),
      };
    case "dip":
      return {
        ...section,
        id: makeKey(),
        switches: section.switches.map((sw) => ({ ...sw, _key: makeKey() })),
      };
    case "note":
      return { ...section, id: makeKey() };
  }
}
