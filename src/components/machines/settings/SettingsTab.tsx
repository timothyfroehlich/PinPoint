"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "~/components/ui/button";
import { InlineEditableField } from "~/components/inline-editable-field";
import { SETTINGS_INSTRUCTIONS_PRESETS } from "~/lib/machines/settings-instructions-presets";
import { SettingsSetCard } from "~/components/machines/settings/SettingsSetCard";
import {
  type SaveOutcome,
  type UnitSaveState,
  useSettingsSaveQueue,
} from "~/components/machines/settings/use-settings-save-queue";
import {
  type AddSectionSpec,
  NAME_MAX,
  type SettingsSection,
  type SettingsSetData,
} from "~/lib/machines/settings-types";
import { docToPlainText, type ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  deleteSettingsSetAction,
  duplicateSettingsSetAction,
  saveSettingsSetAction,
  setPreferredSettingsSetAction,
  updateMachineSettingsInstructionsAction,
  updateMachineSettingsRequestsAction,
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

function isTempId(id: string): boolean {
  return id.startsWith("tmp-");
}

function today(): string {
  // Local calendar date — NOT toISOString() (UTC), which shows tomorrow's date
  // for negative-UTC editors saving late in the evening until a reload corrects
  // it from the server's own timestamp.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The set-header unit's id (set name + description share one Edit/Save). Every
 *  other unit is keyed by its section id, so this just needs to be a value no
 *  section id can collide with. */
const HEADER_UNIT = "header";

/** A per-unit edit key, namespaced by set so several cards' units coexist in the
 *  one editing/saving/error map without colliding. */
function unitKey(setId: string, unitId: string): string {
  return `${setId}:${unitId}`;
}

/**
 * The persist-ready payload for one set (no client `_key`s are stripped here —
 * the action's Zod schema drops them; this is just the working/baseline content).
 * Carried in `pendingPayloadsRef` so the save queue's executor sends EXACTLY the
 * payload a unit's Save (baseline + that unit's slice) or a structural op
 * (computed from baseline) prepared — never a re-read of the whole working copy.
 */
interface SetPayload {
  name: string;
  description: ProseMirrorDoc | null;
  sections: SettingsSection[];
}

/** Deep-ish clone of a set so the baseline and working copy never share mutable
 *  references — a working-copy edit must not silently mutate the baseline. */
function cloneSet(set: SettingsSetData): SettingsSetData {
  return { ...set, sections: set.sections.map(cloneSectionDeep) };
}

/** Clone a section preserving its id/_keys (unlike cloneSection, which is the
 *  duplicate-set deep copy that regenerates them). Used for baseline mirroring. */
function cloneSectionDeep(section: SettingsSection): SettingsSection {
  switch (section.kind) {
    case "software":
    case "table":
      return { ...section, rows: section.rows.map((r) => ({ ...r })) };
    case "dip":
      return { ...section, switches: section.switches.map((s) => ({ ...s })) };
    case "note":
      return { ...section };
  }
}

/**
 * Structural equality of a single unit's slice, used for dirty detection. The
 * rich body (header description / note body) is compared on plain text (matching
 * what actually persists — a whitespace-only draft normalizes to null); every
 * other field is compared by a stable JSON serialization. `a`/`b` are the SAME
 * unit's slice from the working copy and the committed baseline.
 */
function headerSliceDirty(
  working: SettingsSetData,
  baseline: SettingsSetData | undefined
): boolean {
  if (!baseline) return true; // never-saved set: the header is always "dirty"
  return (
    working.name !== baseline.name ||
    docToPlainText(working.description).trim() !==
      docToPlainText(baseline.description).trim()
  );
}

function sectionSliceDirty(
  working: SettingsSetData,
  baseline: SettingsSetData | undefined,
  sectionId: string
): boolean {
  const wSec = working.sections.find((s) => s.id === sectionId);
  const bSec = baseline?.sections.find((s) => s.id === sectionId);
  if (!wSec) return false; // section gone from the working copy — nothing dirty
  if (!bSec) return true; // brand-new draft section not in baseline yet
  if (wSec.kind === "note" && bSec.kind === "note") {
    // Compare the rich body on plain text; everything else structurally.
    return (
      wSec.title !== bSec.title ||
      wSec.customTitle !== bSec.customTitle ||
      docToPlainText(wSec.body).trim() !== docToPlainText(bSec.body).trim()
    );
  }
  return JSON.stringify(wSec) !== JSON.stringify(bSec);
}

/**
 * Navigation guard for the atomic per-unit settings editor (PP-43q3). Edits
 * buffer in the working copy until the owning unit's Save, so an open unit can
 * hold uncommitted changes (single-line OR rich). This warns before refresh /
 * tab-close (`beforeunload`) and in-app soft navigation (a capturing click
 * listener — App Router has no stable blocker) whenever ANY unit is in edit mode
 * with a dirty slice. A merely-collapsed set keeps its draft in memory and does
 * NOT arm the guard.
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
        "You have unsaved settings still open. Leave without saving them?"
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
  /** Machine-level "Before you change anything" — the owner's honor-system
   *  requests for how people should handle this machine's settings. Free text,
   *  no presets; rendered FIRST. Edited via its own inline save (PP-8a5r). */
  settingsRequests: ProseMirrorDoc | null;
  /** Machine-level "How to change settings" (coin-door buttons, DIP locations,
   *  menu navigation). Shared by every set; edited via its own inline save. */
  settingsInstructions: ProseMirrorDoc | null;
}

export function SettingsTab({
  canEdit,
  machineId,
  initialSets,
  settingsRequests,
  settingsInstructions,
}: SettingsTabProps): React.JSX.Element {
  const [sets, setSets] = useState<SettingsSetData[]>(initialSets);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    initialSets[0] ? new Set([initialSets[0].id]) : new Set()
  );
  // Sets created this session that haven't been persisted yet (temp id). The
  // first whole-row save inserts them and swaps the temp id for the server UUID.
  // Preferred/Duplicate target a persisted row, so they're gated on this.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // -- The two parallel copies (PP-43q3 atomic per-unit commit) ---------------
  // setsRef = the WORKING COPY: every field edit (title, cells, DIP, rich body)
  //   mutates this freely while a unit is in edit mode. Mirrored into `sets`
  //   state for rendering; mutated synchronously through `mutateSets` so a save
  //   enqueued in the same tick reads the just-typed value.
  // baselineRef = the COMMITTED BASELINE: the last server-persisted state of each
  //   set, keyed by set id. A unit's Save sends `baseline + that unit's slice`,
  //   so OTHER open units' uncommitted edits are never written — that isolation
  //   is the whole point. On a successful Save (or immediate structural op) the
  //   baseline is advanced to exactly what was sent. A never-saved (temp-id) set
  //   has NO baseline entry until its first Save.
  const setsRef = useRef(sets);
  const baselineRef = useRef<Map<string, SettingsSetData>>(
    new Map(
      initialSets.filter((s) => !isTempId(s.id)).map((s) => [s.id, cloneSet(s)])
    )
  );

  const mutateSets = useCallback(
    (updater: (prev: SettingsSetData[]) => SettingsSetData[]): void => {
      const next = updater(setsRef.current);
      setsRef.current = next;
      setSets(next);
    },
    []
  );

  // Where the next queued save for a set will read its payload from. A unit's
  // Save and the structural ops each write the exact full-set payload here right
  // before enqueuing, so the queue's executor sends THAT (never a re-read of the
  // whole working copy, which would leak other open units' drafts).
  const pendingPayloadsRef = useRef<Map<string, SetPayload>>(new Map());

  // Temp-id → server-UUID swaps recorded by `execute` on a new set's first
  // insert. `saveUnit`'s settle callback reads this to find the unit's LIVE id
  // (the queue + `execute` already rekeyed their own state under the real id).
  const tempToRealRef = useRef<Map<string, string>>(new Map());

  // -- Per-unit edit + save UI state -----------------------------------------
  // editingUnits = which units are open (Set of `${setId}:${unitId}`). Several
  //   may be open at once.
  // savingUnits / unitErrors = the per-unit Save's in-flight + last-error state,
  //   surfaced on that unit's Save button (disabled "Saving…" / inline error).
  const [editingUnits, setEditingUnits] = useState<Set<string>>(() => {
    // New sets (created this session, temp id) open with their header unit in
    // edit mode so the required name lands focused without an extra click.
    const init = new Set<string>();
    for (const s of initialSets) {
      if (isTempId(s.id)) init.add(unitKey(s.id, HEADER_UNIT));
    }
    return init;
  });
  const [savingUnits, setSavingUnits] = useState<Set<string>>(() => new Set());
  const [unitErrors, setUnitErrors] = useState<Map<string, string>>(
    () => new Map()
  );

  const isUnitEditing = useCallback(
    (setId: string, unitId: string): boolean =>
      editingUnits.has(unitKey(setId, unitId)),
    [editingUnits]
  );

  const unitSaveState = useCallback(
    (setId: string, unitId: string): UnitSaveState => {
      const key = unitKey(setId, unitId);
      return {
        saving: savingUnits.has(key),
        error: unitErrors.get(key) ?? null,
      };
    },
    [savingUnits, unitErrors]
  );

  // -- Unsaved-changes guard --------------------------------------------------
  // Arm when ANY open unit's slice differs from its baseline. Computed from the
  // working copy + baseline, so it covers single-line AND rich edits without any
  // child needing to report dirtiness up. `sets` is a dep so the flag re-derives
  // as the user types (the working copy is mirrored into it).
  const anyUnitDirty = (() => {
    for (const key of editingUnits) {
      const sep = key.indexOf(":");
      const setId = key.slice(0, sep);
      const unitId = key.slice(sep + 1);
      const working = sets.find((s) => s.id === setId);
      if (!working) continue;
      const baseline = baselineRef.current.get(setId);
      const dirty =
        unitId === HEADER_UNIT
          ? headerSliceDirty(working, baseline)
          : sectionSliceDirty(working, baseline, unitId);
      if (dirty) return true;
    }
    return false;
  })();

  // The two always-open machine-level fields ("Before you change anything" /
  // "How to change settings") hold their drafts inside InlineEditableField, not
  // in `editingUnits`, so they report dirtiness up here to join the same guard.
  const [machineFieldDirty, setMachineFieldDirty] = useState({
    requests: false,
    instructions: false,
  });
  const onRequestsDirty = useCallback((dirty: boolean): void => {
    setMachineFieldDirty((p) =>
      p.requests === dirty ? p : { ...p, requests: dirty }
    );
  }, []);
  const onInstructionsDirty = useCallback((dirty: boolean): void => {
    setMachineFieldDirty((p) =>
      p.instructions === dirty ? p : { ...p, instructions: dirty }
    );
  }, []);

  useUnsavedChangesGuard(
    canEdit &&
      (anyUnitDirty ||
        machineFieldDirty.requests ||
        machineFieldDirty.instructions)
  );

  // The whole-row persist executor handed to the save queue. Sends the exact
  // payload `pendingPayloadsRef` holds for this set (prepared by a unit Save or a
  // structural op), upserts via the existing action (jsonb whole-row — schema
  // unchanged), and on a new set's first insert returns the temp→real id swap so
  // the queue keeps draining under the real id.
  const execute = useCallback(
    async (
      setId: string
    ): Promise<{ outcome: SaveOutcome; rekeyTo?: string }> => {
      const payload = pendingPayloadsRef.current.get(setId);
      // No payload staged (the set was deleted, or its id already swapped) —
      // nothing to send.
      if (!payload) return { outcome: { ok: true } };

      const isNew = isTempId(setId);
      // A new set can't insert without its required name.
      if (isNew && payload.name.trim() === "") return { outcome: { ok: true } };

      const result = await saveSettingsSetAction({
        machineId,
        ...(isNew ? {} : { id: setId }),
        name: payload.name,
        description: payload.description,
        sections: payload.sections,
      });
      if (!result.success)
        return { outcome: { ok: false, error: result.error } };

      // Persist succeeded → advance this set's committed baseline to exactly the
      // payload we sent. (Keep the set's identity fields off the payload-derived
      // baseline by merging the live working copy's metadata onto the slice.)
      const realId = result.id;

      // Clear ONLY the payload we actually sent. A concurrent unit Save during
      // the await above may have staged a NEWER payload that the queue's
      // coalesced rerun still has to send; deleting it unconditionally was the
      // data-loss bug (the rerun then found nothing staged and silently no-op'd,
      // so e.g. a section saved while a brand-new set's first insert was in
      // flight never reached the DB).
      const stagedNow = pendingPayloadsRef.current.get(setId);
      const newerPending =
        stagedNow && stagedNow !== payload ? stagedNow : null;
      if (!newerPending) pendingPayloadsRef.current.delete(setId);

      if (isNew && realId !== setId) {
        // Record the swap so the unit's settle callback can find its live id.
        tempToRealRef.current.set(setId, realId);
        // Carry any newer pending payload (staged under the TEMP id) over to the
        // real id so the rerun persists it as an UPDATE against the just-inserted
        // row. Force the name/description to what we just inserted: the newer
        // slice was built before this set had a baseline, so its name/description
        // are not authoritative and would otherwise clobber the inserted header.
        if (newerPending) {
          pendingPayloadsRef.current.delete(setId);
          pendingPayloadsRef.current.set(realId, {
            ...newerPending,
            name: payload.name,
            description: payload.description,
          });
        }
        // Swap temp id → server UUID across every id-keyed piece of state, and
        // stamp the fresh authorship/timestamp the insert just wrote.
        mutateSets((prev) =>
          prev.map((s) =>
            s.id === setId
              ? { ...s, id: realId, updatedBy: "You", updatedAt: today() }
              : s
          )
        );
        // Baseline the just-inserted set to EXACTLY the slice we sent (name +
        // description; sections are [] for a header insert) — NOT the full
        // working copy. The working copy may already hold unsaved sections the
        // server doesn't have yet; baselining from it falsely marked those as
        // committed (a phantom commit, lost on reload). Sections that still need
        // saving therefore stay dirty against this baseline.
        const persisted = setsRef.current.find((s) => s.id === realId);
        if (persisted) {
          baselineRef.current.set(realId, {
            ...persisted,
            name: payload.name,
            description: payload.description,
            sections: payload.sections.map(cloneSectionDeep),
          });
        }
        setExpandedIds((prev) => {
          const next = new Set(prev);
          if (next.delete(setId)) next.add(realId);
          return next;
        });
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(setId);
          return next;
        });
        // Re-prefix this set's per-unit edit/saving/error state from the temp id
        // to the real one (only the `${setId}:` prefix changes) so an open unit
        // stays open after the first save.
        rekeyUnitPrefixed(setId, realId, setEditingUnits, setSavingUnits);
        rekeyErrorMap(setId, realId, setUnitErrors);
        return { outcome: { ok: true }, rekeyTo: realId };
      }

      // Existing set: advance the baseline to the freshest working copy that
      // matches the sent payload, and mirror the new editor/timestamp locally.
      if (result.changed) {
        mutateSets((prev) =>
          prev.map((s) =>
            s.id === setId ? { ...s, updatedBy: "You", updatedAt: today() } : s
          )
        );
      }
      const persisted = setsRef.current.find((s) => s.id === setId);
      if (persisted) {
        // Baseline = the metadata-stamped working copy but with this set's
        // content replaced by exactly what we sent (so a concurrent edit to
        // ANOTHER unit, made while this save was in flight, does NOT leak into
        // the baseline — only the sent slice advances).
        baselineRef.current.set(setId, {
          ...persisted,
          name: payload.name,
          description: payload.description,
          sections: payload.sections.map(cloneSectionDeep),
        });
      }
      return { outcome: { ok: true } };
    },
    [machineId, mutateSets]
  );

  const saveQueue = useSettingsSaveQueue(execute);

  // The preferred set is always pinned to the top. A stable sort preserves the
  // insertion order of everything else (new sets, etc.).
  const orderedSets = [...sets].sort(
    (a, b) => Number(b.isPreferred) - Number(a.isPreferred)
  );

  function removeLocal(id: string): void {
    mutateSets((prev) => prev.filter((s) => s.id !== id));
    baselineRef.current.delete(id);
    pendingPayloadsRef.current.delete(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setNewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Drop every editing/saving/error entry for this set's units.
    dropUnitPrefixed(id, setEditingUnits, setSavingUnits);
    dropErrorPrefixed(id, setUnitErrors);
    saveQueue.forget(id);
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
    // Preferred is a row flag, not a unit slice — update both working copy and
    // baseline so it never reads as a pending edit.
    const apply = (s: SettingsSetData): SettingsSetData => ({
      ...s,
      isPreferred: s.id === id ? next : next ? false : s.isPreferred,
      // The server bumps updatedBy/updatedAt only on the promoted set; mirror
      // that locally so its "updated by …" line isn't stale until reload.
      ...(s.id === id && next ? { updatedBy: "You", updatedAt: today() } : {}),
    });
    mutateSets((prev) => prev.map(apply));
    for (const [bid, b] of baselineRef.current) {
      baselineRef.current.set(bid, apply(b));
    }
  }

  function renameSet(id: string, name: string): void {
    mutateSets((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
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
    mutateSets((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    // The copy is already persisted server-side → baseline it immediately.
    baselineRef.current.set(copy.id, cloneSet(copy));
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
      // Intentionally blank — the header unit opens in edit mode (below) so the
      // name field is focused and required; the set is INSERTED on its first
      // Save (which swaps in the server UUID). A never-saved set has no baseline.
      name: "",
      isPreferred: false,
      updatedBy: "You",
      updatedAt: today(),
      description: null,
      sections: [],
    };
    mutateSets((prev) => [newSet, ...prev]);
    setExpandedIds((prev) => new Set(prev).add(id));
    setNewIds((prev) => new Set(prev).add(id));
    // Open the header unit in edit mode so the required name lands focused.
    setEditingUnits((prev) => new Set(prev).add(unitKey(id, HEADER_UNIT)));
  }

  function updateDescription(id: string, value: ProseMirrorDoc | null): void {
    mutateSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, description: value } : s))
    );
  }

  // -- Section-level working-copy mutations (buffer only) --------------------
  function mapSections(
    setId: string,
    fn: (sections: SettingsSection[]) => SettingsSection[]
  ): void {
    mutateSets((prev) =>
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
    // Mint the section id up front so the freshly added section can open in edit
    // mode immediately. Add-as-DRAFT (PP-43q3): the new section lives in the
    // working copy only and is NOT persisted until its own Save — so it has no
    // baseline slice yet (sectionSliceDirty treats a missing baseline slice as
    // dirty, which is correct: a brand-new draft is always "unsaved").
    const sectionId = makeKey();
    mutateSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId) return s;
        let section: SettingsSection;
        if (spec.kind === "software") {
          section = {
            id: sectionId,
            kind: "software",
            baseline: "Factory Install",
            rows: [{ _key: makeKey(), id: "", name: "", value: "" }],
          };
        } else if (spec.kind === "table") {
          section = {
            id: sectionId,
            kind: "table",
            title: "",
            rows: [],
          };
        } else if (spec.kind === "dip") {
          const num = s.sections.filter((x) => x.kind === "dip").length + 1;
          section = {
            id: sectionId,
            kind: "dip",
            name: `Bank ${String(num)}`,
            switches: [
              { _key: makeKey(), switch: "", position: "OFF", note: "" },
            ],
          };
        } else {
          section = {
            id: sectionId,
            kind: "note",
            title: spec.title,
            body: null,
            customTitle: spec.customTitle,
          };
        }
        return { ...s, sections: [...s.sections, section] };
      })
    );
    // Drop the user straight into the new section's edit mode (it commits on its
    // own Save; Cancel on this never-saved section removes it — see cancelUnit).
    setEditingUnits((prev) => new Set(prev).add(unitKey(setId, sectionId)));
  }

  // -- Immediate structural ops (delete section / reorder) -------------------
  // These persist RIGHT AWAY, computed from the committed BASELINE so an open
  // unit's uncommitted edits are never written. They reorder/remove by section
  // id in BOTH the working copy AND the baseline, so a different unit's in-
  // progress draft (which lives only in the working copy) is preserved through
  // the operation. For a NEVER-SAVED set (no baseline), the op is local only.

  function deleteSection(setId: string, sectionId: string): void {
    // Working copy: drop the section (preserving other sections' drafts).
    mapSections(setId, (sections) =>
      sections.filter((sec) => sec.id !== sectionId)
    );
    // Drop any edit/saving/error state for the removed section.
    const key = unitKey(setId, sectionId);
    setEditingUnits((prev) => removeFromSet(prev, key));
    setSavingUnits((prev) => removeFromSet(prev, key));
    setUnitErrors((prev) => removeFromMap(prev, key));

    const baseline = baselineRef.current.get(setId);
    if (!baseline) return; // never-saved set: nothing to persist
    // Baseline: remove the same section, then persist baseline-as-payload.
    const nextBaseline: SettingsSetData = {
      ...baseline,
      sections: baseline.sections.filter((sec) => sec.id !== sectionId),
    };
    baselineRef.current.set(setId, nextBaseline);
    stagePayload(setId, nextBaseline);
    void saveQueue.persist(setId);
  }

  function reorderSections(
    setId: string,
    activeId: string,
    overId: string
  ): void {
    const reorder = (sections: SettingsSection[]): SettingsSection[] => {
      const oldIndex = sections.findIndex((sec) => sec.id === activeId);
      const newIndex = sections.findIndex((sec) => sec.id === overId);
      if (oldIndex < 0 || newIndex < 0) return sections;
      return arrayMove(sections, oldIndex, newIndex);
    };
    // Working copy: reorder (preserving every section's draft content).
    mapSections(setId, reorder);

    const baseline = baselineRef.current.get(setId);
    if (!baseline) return; // never-saved set: order is local until first Save
    const nextBaseline: SettingsSetData = {
      ...baseline,
      sections: reorder(baseline.sections),
    };
    baselineRef.current.set(setId, nextBaseline);
    stagePayload(setId, nextBaseline);
    void saveQueue.persist(setId);
  }

  // Keyboard / mobile reorder path (WCAG 2.2 SC 2.5.7 — a non-drag alternative
  // to the desktop grip). Swaps a section with its neighbor; persists from the
  // baseline like the drag path, preserving other units' drafts.
  function moveSection(
    setId: string,
    sectionId: string,
    direction: "up" | "down"
  ): void {
    const swap = (sections: SettingsSection[]): SettingsSection[] => {
      const index = sections.findIndex((sec) => sec.id === sectionId);
      if (index < 0) return sections;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= sections.length) return sections;
      return arrayMove(sections, index, target);
    };
    mapSections(setId, swap);

    const baseline = baselineRef.current.get(setId);
    if (!baseline) return;
    const nextBaseline: SettingsSetData = {
      ...baseline,
      sections: swap(baseline.sections),
    };
    baselineRef.current.set(setId, nextBaseline);
    stagePayload(setId, nextBaseline);
    void saveQueue.persist(setId);
  }

  // -- Software / table row working-copy mutations (buffer only) -------------
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
      sec.kind === "software" || sec.kind === "table"
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
      sec.kind === "software" || sec.kind === "table"
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
      sec.kind === "software" || sec.kind === "table"
        ? { ...sec, rows: sec.rows.filter((r) => r._key !== rowKey) }
        : sec
    );
  }

  function updateTableTitle(
    setId: string,
    sectionId: string,
    title: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "table" ? { ...sec, title } : sec
    );
  }

  // -- DIP switch working-copy mutations (buffer only) -----------------------
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

  // -- Note section working-copy mutations (buffer only) ---------------------
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

  // -- Unit Edit / Save / Cancel ---------------------------------------------
  function editUnit(setId: string, unitId: string): void {
    setEditingUnits((prev) => new Set(prev).add(unitKey(setId, unitId)));
  }

  // Stage `pendingPayloadsRef[setId]` from a full set (baseline or working copy).
  function stagePayload(setId: string, source: SettingsSetData): void {
    pendingPayloadsRef.current.set(setId, {
      name: source.name,
      description: source.description,
      sections: source.sections.map(cloneSectionDeep),
    });
  }

  /**
   * Build the atomic Save payload for one unit: start from the committed
   * BASELINE (or, for a never-saved set, an empty shell), then overlay ONLY this
   * unit's slice from the working copy. Any OTHER open unit's uncommitted edits
   * are intentionally excluded — that isolation is the atomicity guarantee.
   */
  function buildUnitPayload(setId: string, unitId: string): SetPayload | null {
    const working = setsRef.current.find((s) => s.id === setId);
    if (!working) return null;
    const baseline = baselineRef.current.get(setId);

    if (unitId === HEADER_UNIT) {
      // Header slice = { name, description } from the working copy; sections come
      // from the baseline (empty for a never-saved set).
      return {
        name: working.name,
        description: working.description,
        sections: (baseline?.sections ?? []).map(cloneSectionDeep),
      };
    }

    // Section slice: baseline's name/description, baseline's sections but with
    // THIS section replaced (or appended, for a brand-new draft section) by the
    // working copy's version.
    const workingSection = working.sections.find((s) => s.id === unitId);
    if (!workingSection) return null;
    const baseName = baseline?.name ?? working.name;
    const baseDescription = baseline?.description ?? null;
    const baseSections = (baseline?.sections ?? []).map(cloneSectionDeep);
    const idx = baseSections.findIndex((s) => s.id === unitId);
    if (idx >= 0) {
      baseSections[idx] = cloneSectionDeep(workingSection);
    } else {
      // A brand-new draft section: append it in the working copy's position.
      // (Position relative to other baseline sections is preserved on the next
      // structural op; appending is correct for the common "add at the end".)
      baseSections.push(cloneSectionDeep(workingSection));
    }
    return {
      name: baseName,
      description: baseDescription,
      sections: baseSections,
    };
  }

  // Save: commit ONLY this unit's slice onto the baseline, atomically. Required-
  // title units (set name, table title, custom note title) block an empty Save.
  function saveUnit(setId: string, unitId: string): void {
    const payload = buildUnitPayload(setId, unitId);
    if (!payload) return;

    // Required-name guard: a never-named set / required-title section can't be
    // saved empty. (The fields surface the inline "(required)" state on commit.)
    if (unitId === HEADER_UNIT) {
      if (payload.name.trim() === "") return;
    } else {
      const sec = payload.sections.find((s) => s.id === unitId);
      if (sec?.kind === "table" && sec.title.trim() === "") return;
      if (sec?.kind === "note" && sec.customTitle && sec.title.trim() === "")
        return;
    }

    pendingPayloadsRef.current.set(setId, payload);
    const key = unitKey(setId, unitId);
    setSavingUnits((prev) => new Set(prev).add(key));
    setUnitErrors((prev) => removeFromMap(prev, key));

    void saveQueue.persist(setId).then((outcome) => {
      // The set's id may have swapped (temp→real) during the insert; the queue
      // rekeys its own entry, and `execute` rekeyed our unit-state maps, so read
      // the live id back (via the recorded swap) to settle the right unit.
      const liveSetId = tempToRealRef.current.get(setId) ?? setId;
      const liveKey = unitKey(liveSetId, unitId);
      setSavingUnits((prev) => removeFromSet(prev, liveKey));
      if (outcome.ok) {
        // Success: close the unit.
        setEditingUnits((prev) => removeFromSet(prev, liveKey));
      } else {
        // Failure: keep the unit open with the typed values; show the error and
        // let the Save button act as Retry.
        setUnitErrors((prev) => new Map(prev).set(liveKey, outcome.error));
      }
    });
  }

  // Cancel: discard this unit's draft by copying its slice from the committed
  // baseline back into the working copy, then close the unit. A brand-new draft
  // (no baseline slice) is removed entirely; a never-saved SET cancelled from
  // its header is discarded wholesale.
  function cancelUnit(setId: string, unitId: string): void {
    const key = unitKey(setId, unitId);
    const baseline = baselineRef.current.get(setId);

    if (unitId === HEADER_UNIT) {
      if (!baseline) {
        // Never-saved set: Cancel discards the whole set.
        removeLocal(setId);
        return;
      }
      // Restore name + description from the baseline.
      mutateSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, name: baseline.name, description: baseline.description }
            : s
        )
      );
    } else {
      const baseSection = baseline?.sections.find((s) => s.id === unitId);
      if (!baseSection) {
        // Brand-new draft section (never saved): Cancel removes it.
        mapSections(setId, (sections) =>
          sections.filter((sec) => sec.id !== unitId)
        );
      } else {
        // Restore the section's slice from the baseline.
        mapSections(setId, (sections) =>
          sections.map((sec) =>
            sec.id === unitId ? cloneSectionDeep(baseSection) : sec
          )
        );
      }
    }

    setEditingUnits((prev) => removeFromSet(prev, key));
    setUnitErrors((prev) => removeFromMap(prev, key));
  }

  return (
    <div className="space-y-4 max-md:space-y-2.5">
      {/* SECTION 1 — the owner's requests ("Before you change anything"), above
          everything. Free text, NO presets, framed as a request not a rule
          (PP-8a5r governance-neutrality). For a permitted user the empty state
          is an already-open editor with the encouraging placeholder; a
          read-only viewer sees nothing when empty. Saved independently (its own
          explicit Save/Cancel, shown once the draft is dirty). */}
      <InlineEditableField
        label="Before you change anything"
        value={settingsRequests}
        machineId={machineId}
        canEdit={canEdit}
        placeholder="How would you like people to handle your machine's settings — who to ask, how to make changes, anything to avoid? Even one sentence protects the setup you've dialed in."
        testId="machine-settings-requests"
        openWhenEmpty
        headingProminent
        onDirtyChange={onRequestsDirty}
        onSave={async (id, value) => {
          const result = await updateMachineSettingsRequestsAction({
            machineId: id,
            value,
          });
          return result.success
            ? { ok: true }
            : { ok: false, message: result.error };
        }}
      />

      {/* SECTION 2 — machine-level access instructions ("How to change
          settings"). Free text + platform presets surfaced as a "Start from a
          preset" control above the open editor. Shared by every set and saved
          independently. Empty state for a permitted user = an open editor; a
          read-only viewer sees nothing when empty. */}
      <InlineEditableField
        label="How to change settings"
        value={settingsInstructions}
        machineId={machineId}
        canEdit={canEdit}
        placeholder="How to change the settings on this machine — menus, button meanings, where the DIP switches are. Or start from a preset above."
        testId="machine-settings-instructions"
        presets={SETTINGS_INSTRUCTIONS_PRESETS}
        openWhenEmpty
        headingProminent
        onDirtyChange={onInstructionsDirty}
        onSave={async (id, value) => {
          const result = await updateMachineSettingsInstructionsAction({
            machineId: id,
            value,
          });
          return result.success
            ? { ok: true }
            : { ok: false, message: result.error };
        }}
      />

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
        // Mobile: an 8px slice of page background between sets — with the
        // header band + divider it gives each set a card-like silhouette.
        <div className="space-y-3 max-md:space-y-2">
          {orderedSets.map((set) => (
            <SettingsSetCard
              key={set.id}
              set={set}
              isExpanded={expandedIds.has(set.id)}
              canEdit={canEdit}
              isNew={newIds.has(set.id)}
              headerUnitId={HEADER_UNIT}
              isUnitEditing={(unitId) => isUnitEditing(set.id, unitId)}
              unitSaveState={(unitId) => unitSaveState(set.id, unitId)}
              onEditUnit={(unitId) => {
                editUnit(set.id, unitId);
              }}
              onSaveUnit={(unitId) => {
                saveUnit(set.id, unitId);
              }}
              onCancelUnit={(unitId) => {
                cancelUnit(set.id, unitId);
              }}
              onMoveSection={(sectionId, direction) => {
                moveSection(set.id, sectionId, direction);
              }}
              onToggleExpand={() => {
                toggleExpand(set.id);
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
              onUpdateTableTitle={(sectionId, title) => {
                updateTableTitle(set.id, sectionId, title);
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

// -- Small immutable Set/Map helpers (no mutation of the previous value) -----
function removeFromSet(prev: Set<string>, key: string): Set<string> {
  if (!prev.has(key)) return prev;
  const next = new Set(prev);
  next.delete(key);
  return next;
}

function removeFromMap(
  prev: Map<string, string>,
  key: string
): Map<string, string> {
  if (!prev.has(key)) return prev;
  const next = new Map(prev);
  next.delete(key);
  return next;
}

/** Re-prefix every `${fromId}:`-keyed entry of two string-Set states to
 *  `${toId}:` (used on a new set's temp→real id swap). */
function rekeyUnitPrefixed(
  fromId: string,
  toId: string,
  setEditing: React.Dispatch<React.SetStateAction<Set<string>>>,
  setSaving: React.Dispatch<React.SetStateAction<Set<string>>>
): void {
  const rekey = (prev: Set<string>): Set<string> => {
    const fromPrefix = `${fromId}:`;
    let changed = false;
    const next = new Set<string>();
    for (const k of prev) {
      if (k.startsWith(fromPrefix)) {
        next.add(`${toId}:${k.slice(fromPrefix.length)}`);
        changed = true;
      } else {
        next.add(k);
      }
    }
    return changed ? next : prev;
  };
  setEditing(rekey);
  setSaving(rekey);
}

function rekeyErrorMap(
  fromId: string,
  toId: string,
  setErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>
): void {
  setErrors((prev) => {
    const fromPrefix = `${fromId}:`;
    let changed = false;
    const next = new Map<string, string>();
    for (const [k, v] of prev) {
      if (k.startsWith(fromPrefix)) {
        next.set(`${toId}:${k.slice(fromPrefix.length)}`, v);
        changed = true;
      } else {
        next.set(k, v);
      }
    }
    return changed ? next : prev;
  });
}

/** Drop every `${setId}:`-prefixed entry from two string-Set states (on delete). */
function dropUnitPrefixed(
  setId: string,
  setEditing: React.Dispatch<React.SetStateAction<Set<string>>>,
  setSaving: React.Dispatch<React.SetStateAction<Set<string>>>
): void {
  const drop = (prev: Set<string>): Set<string> => {
    const prefix = `${setId}:`;
    let changed = false;
    const next = new Set(prev);
    for (const k of prev) {
      if (k.startsWith(prefix)) {
        next.delete(k);
        changed = true;
      }
    }
    return changed ? next : prev;
  };
  setEditing(drop);
  setSaving(drop);
}

function dropErrorPrefixed(
  setId: string,
  setErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>
): void {
  setErrors((prev) => {
    const prefix = `${setId}:`;
    let changed = false;
    const next = new Map(prev);
    for (const k of prev.keys()) {
      if (k.startsWith(prefix)) {
        next.delete(k);
        changed = true;
      }
    }
    return changed ? next : prev;
  });
}

/** Deep-clone one section, regenerating every key/id so the copy is isolated
 *  (the duplicate-set path). */
function cloneSection(section: SettingsSection): SettingsSection {
  switch (section.kind) {
    case "software":
    case "table":
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
