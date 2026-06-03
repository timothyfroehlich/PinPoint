"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "~/components/ui/button";
import { SettingsSetCard } from "~/components/machines/settings/SettingsSetCard";
import {
  type AddSectionSpec,
  NAME_MAX,
  type SettingsSection,
  type SettingsSetData,
} from "~/lib/machines/settings-types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  deleteSettingsSetAction,
  duplicateSettingsSetAction,
  saveSettingsSetAction,
  setPreferredSettingsSetAction,
} from "~/app/(app)/m/[initials]/(tabs)/settings/actions";

// Collision-free client keys (render keys + section ids + temp set ids).
// `crypto.randomUUID()` is available in every browser PinPoint targets and on
// localhost (a secure context); the timestamp+small-random scheme it replaces
// could collide when several keys were minted in the same millisecond.
function makeKey(): string {
  return globalThis.crypto.randomUUID();
}

function makeTempSetId(): string {
  return `tmp-${globalThis.crypto.randomUUID()}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Guard against losing unsaved edits. `beforeunload` covers refresh / tab-close
 * / hard navigation (the Baseline guarantee). A capturing click listener covers
 * in-app soft navigation (App Router has no stable blocker) by confirming
 * before following any same-tab link while edits are pending.
 */
function useUnsavedChangesGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      // Modern browsers (incl. current Safari) show the native prompt on
      // preventDefault alone. The legacy `returnValue` is deprecated, so we
      // deliberately don't set it.
      e.preventDefault();
    };
    const onClickCapture = (e: MouseEvent): void => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      const ok = window.confirm(
        "You have unsaved settings changes. Leave without saving?"
      );
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [enabled]);
}

interface SettingsTabProps {
  canEdit: boolean;
  machineId: string;
  initialSets: SettingsSetData[];
}

export function SettingsTab({
  canEdit,
  machineId,
  initialSets,
}: SettingsTabProps): React.JSX.Element {
  const [sets, setSets] = useState<SettingsSetData[]>(initialSets);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    initialSets[0] ? new Set([initialSets[0].id]) : new Set()
  );
  // Edit mode is PER SET — content editing unlocks only for sets in this set.
  // Set-level operations (Duplicate, Delete, Preferred, New set) stay available
  // whenever `canEdit` (the owner/tech+ permission) is true.
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  // Sets created this session that haven't been persisted yet (temp id). Save
  // on Done inserts them and swaps the temp id for the server UUID.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  // Sets with an in-flight save — drives the "Saving…" label and guards against
  // a double-submit (a second Done that would insert a new set twice).
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  // Sets that just saved — drives the brief "Saved!" confirmation, cleared by a
  // timer in flashSaved.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // A pending save id, set by the Done click and consumed by the effect below.
  // Deferring through state lets the save read `sets` AFTER the focused cell's
  // on-blur commit has flushed (clicking Done blurs the active cell first) —
  // saving straight from the click handler would snapshot the pre-commit `sets`
  // and silently drop the last edit.
  const [saveRequest, setSaveRequest] = useState<string | null>(null);

  // Any set in edit mode may have unsaved changes (save happens on Done).
  useUnsavedChangesGuard(editingIds.size > 0);

  // Fire only when a save is requested. `saveSet` is read from this render's
  // closure, which holds the post-blur-commit `sets` — the whole reason the
  // save is deferred through state rather than called from the click handler.
  useEffect(() => {
    if (saveRequest === null) return;
    const id = saveRequest;
    setSaveRequest(null);
    void saveSet(id);
  }, [saveRequest]);

  function flashSaved(id: string): void {
    setSavedIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  }

  // The preferred set is always pinned to the top. A stable sort preserves the
  // insertion order of everything else (new sets, etc.).
  const orderedSets = [...sets].sort(
    (a, b) => Number(b.isPreferred) - Number(a.isPreferred)
  );

  function removeLocal(id: string): void {
    setSets((prev) => prev.filter((s) => s.id !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setNewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  /** Persist a set on leaving edit mode (insert when new, else update). */
  async function saveSet(id: string): Promise<void> {
    if (savingIds.has(id)) return; // a save is already in flight — don't double-submit
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    const isNew = newIds.has(id);

    setSavingIds((prev) => new Set(prev).add(id));
    let result: Awaited<ReturnType<typeof saveSettingsSetAction>>;
    try {
      result = await saveSettingsSetAction({
        machineId,
        ...(isNew ? {} : { id }),
        name: set.name,
        description: set.description,
        sections: set.sections,
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    if (!result.success) {
      toast.error(result.error);
      return; // stay in edit mode so the user can retry
    }

    // Leave edit mode; reconcile the temp id → server UUID for new sets in a
    // single pass across every id-keyed piece of state.
    const realId = result.id;
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (isNew && realId !== id) {
      setSets((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, id: realId, updatedBy: "You", updatedAt: today() }
            : s
        )
      );
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.delete(id)) next.add(realId);
        return next;
      });
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else if (result.changed) {
      // Existing set actually changed — reflect the new editor/timestamp
      // locally so the "updated by …" line isn't stale until the next load.
      // A no-op save (changed === false) leaves the metadata untouched.
      setSets((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, updatedBy: "You", updatedAt: today() } : s
        )
      );
    }
    // Brief "Saved!" confirmation on the (now collapsed) set's button.
    flashSaved(isNew && realId !== id ? realId : id);
  }

  function toggleSetEdit(id: string): void {
    if (editingIds.has(id)) {
      // Defer the save to the effect so it runs after the focused cell's
      // on-blur commit has flushed into `sets` (see saveRequest above).
      setSaveRequest(id);
      return;
    }
    setEditingIds((prev) => new Set(prev).add(id));
    setExpandedIds((prev) => new Set(prev).add(id));
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

  async function togglePreferred(id: string): Promise<void> {
    if (newIds.has(id)) return; // can't prefer an unsaved set
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    const next = !set.isPreferred;
    const result = await setPreferredSettingsSetAction({
      id,
      isPreferred: next,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        isPreferred: s.id === id ? next : next ? false : s.isPreferred,
        // The server bumps updatedBy/updatedAt only on the promoted set; mirror
        // that locally so its "updated by …" line isn't stale until reload.
        ...(s.id === id && next
          ? { updatedBy: "You", updatedAt: today() }
          : {}),
      }))
    );
  }

  function renameSet(id: string, name: string): void {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  async function duplicateSet(id: string): Promise<void> {
    if (newIds.has(id)) return; // save the original before copying it
    const original = sets.find((s) => s.id === id);
    if (!original) return;
    const result = await duplicateSettingsSetAction({ id });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    // Reconstruct the copy locally using the server-returned id so subsequent
    // ops target the real row.
    // Match the server's name capping (NAME_MAX) so the optimistic copy name
    // is byte-identical to what was persisted.
    const COPY_SUFFIX = " (copy)";
    const copy: SettingsSetData = {
      ...original,
      id: result.id,
      name: `${original.name.slice(0, NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`,
      isPreferred: false,
      updatedBy: "You",
      updatedAt: today(),
      sections: original.sections.map(cloneSection),
    };
    setSets((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  async function deleteSet(id: string): Promise<void> {
    if (newIds.has(id)) {
      removeLocal(id); // unsaved — nothing to delete server-side
      return;
    }
    const result = await deleteSettingsSetAction({ id });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    removeLocal(id);
  }

  function addNewSet(): void {
    const id = makeTempSetId();
    const newSet: SettingsSetData = {
      id,
      // Intentionally blank — the card opens with the name field focused and
      // required, so the owner must name it before leaving edit mode.
      name: "",
      isPreferred: false,
      updatedBy: "You",
      updatedAt: today(),
      description: null,
      sections: [],
    };
    setSets((prev) => [newSet, ...prev]);
    setExpandedIds((prev) => new Set(prev).add(id));
    setEditingIds((prev) => new Set(prev).add(id));
    setNewIds((prev) => new Set(prev).add(id));
  }

  function updateDescription(id: string, value: ProseMirrorDoc | null): void {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, description: value } : s))
    );
  }

  // -- Section-level operations --
  function mapSections(
    setId: string,
    fn: (sections: SettingsSection[]) => SettingsSection[]
  ): void {
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, sections: fn(s.sections) } : s))
    );
  }

  function updateSection(
    setId: string,
    sectionId: string,
    updater: (section: SettingsSection) => SettingsSection
  ): void {
    mapSections(setId, (sections) =>
      sections.map((sec) => (sec.id === sectionId ? updater(sec) : sec))
    );
  }

  function addSection(setId: string, spec: AddSectionSpec): void {
    setSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId) return s;
        let section: SettingsSection;
        if (spec.kind === "software") {
          section = {
            id: makeKey(),
            kind: "software",
            baseline: "Factory Install",
            baselineNote: "",
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

  // -- Software-settings handlers (scoped to a software section) --
  function updateBaseline(
    setId: string,
    sectionId: string,
    baseline: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "software" ? { ...sec, baseline } : sec
    );
  }

  function updateBaselineNote(
    setId: string,
    sectionId: string,
    baselineNote: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "software" ? { ...sec, baselineNote } : sec
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
            "No settings sets recorded yet."
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
              isSaving={savingIds.has(set.id)}
              justSaved={savedIds.has(set.id)}
              onToggleExpand={() => {
                toggleExpand(set.id);
              }}
              onToggleEdit={() => {
                toggleSetEdit(set.id);
              }}
              onTogglePreferred={() => {
                void togglePreferred(set.id);
              }}
              onRename={(name) => {
                renameSet(set.id, name);
              }}
              onDuplicate={() => {
                void duplicateSet(set.id);
              }}
              onDelete={() => {
                void deleteSet(set.id);
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
              onUpdateBaselineNote={(sectionId, value) => {
                updateBaselineNote(set.id, sectionId, value);
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
function cloneSection(section: SettingsSection): SettingsSection {
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
