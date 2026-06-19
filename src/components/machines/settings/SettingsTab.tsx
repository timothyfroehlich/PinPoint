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
import { SaveFailureBanner } from "~/components/machines/settings/SaveFailureBanner";
import {
  type SaveOutcome,
  useSettingsSaveQueue,
} from "~/components/machines/settings/use-settings-save-queue";
import { useAutoSave } from "~/components/machines/settings/use-auto-save";
import { useSaveStatus } from "~/components/machines/settings/use-save-status";
import { pruneEmptyRows } from "~/components/machines/settings/prune-empty-rows";
import {
  type AddSectionSpec,
  NAME_MAX,
  type SettingsSection,
  type SettingsSetData,
} from "~/lib/machines/settings-types";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  deleteSettingsSetAction,
  duplicateSettingsSetAction,
  saveSettingsSetAction,
  setPreferredSettingsSetAction,
  updateMachineSettingsInstructionsAction,
  updateMachineSettingsRequestsAction,
} from "~/app/(app)/m/[initials]/(tabs)/settings/actions";

// Collision-free client keys (render keys + section ids + temp set ids).
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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The persist-ready payload for one set (no client `_key`s are stripped here —
 * the action's Zod schema drops them; this is just the working/baseline content).
 * Carried in `pendingPayloadsRef` so the save queue's executor sends EXACTLY the
 * payload staged right before `persist` — never a re-read of the whole working
 * copy.
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
 * Navigation guard for the auto-save settings editor (PP-43q3). Warns before
 * refresh / tab-close (`beforeunload`) and in-app soft navigation (a capturing
 * click listener) whenever there are unsaved (pending or failed) saves.
 */
function useUnsavedChangesGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      // Modern browsers show the native prompt on preventDefault alone.
      e.preventDefault();
      // Note: flushAll() is called separately in the beforeunload handler in
      // SettingsTab; async writes may not complete on unload — the nav guard
      // is the real protection.
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
  // first auto-save inserts them and swaps the temp id for the server UUID.
  // Preferred/Duplicate target a persisted row, so they're gated on this.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // -- The two parallel copies (PP-43q3 always-live auto-save) ----------------
  // setsRef = the WORKING COPY: every field edit mutates this freely and
  //   triggers an auto-save. Mirrored into `sets` state for rendering; mutated
  //   synchronously through `mutateSets` so a save enqueued in the same tick
  //   reads the just-typed value.
  // baselineRef = the COMMITTED BASELINE: the last server-persisted state of
  //   each set, keyed by set id. Advanced to exactly what was sent on each
  //   successful save. A never-saved (temp-id) set has NO baseline entry until
  //   its first successful auto-save.
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

  // Where the next queued save for a set will read its payload from. Each
  // auto-save trigger writes the FULL working copy here right before enqueuing,
  // so the queue's executor sends THAT payload — not a re-read inside execute.
  // This is the C1 (Critical) staging discipline: stage THEN schedule/flush,
  // so the identity-based newerPending check in execute works correctly.
  const pendingPayloadsRef = useRef<Map<string, SetPayload>>(new Map());

  // Temp-id → server-UUID swaps recorded by `execute` on a new set's first
  // insert. (The queue + `execute` already rekeyed their own state under the
  // real id before this is consulted.)
  const tempToRealRef = useRef<Map<string, string>>(new Map());

  // -- Save status (failure-only, no "Saved ✓") --------------------------------
  const saveStatus = useSaveStatus();

  // One-shot auto-retry: each set id gets at most one automatic retry after a
  // failure (5 s delay); after that the user must click Retry in the banner.
  const autoRetried = useRef(new Set<string>());
  const retryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Use a ref for runSave so the setTimeout callback always calls the latest
  // version (avoids stale-closure over saveStatus/saveQueue).
  const runSaveRef = useRef<(id: string) => void>(() => undefined);

  // -- The whole-row persist executor handed to the save queue -----------------
  const execute = useCallback(
    async (
      setId: string
    ): Promise<{ outcome: SaveOutcome; rekeyTo?: string }> => {
      const payload = pendingPayloadsRef.current.get(setId);
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

      const realId = result.id;

      // Clear ONLY the payload we actually sent. A concurrent edit during the
      // await may have staged a NEWER payload that the queue's coalesced rerun
      // still has to send; deleting it unconditionally was the data-loss bug
      // (the rerun then found nothing staged and silently no-op'd).
      const stagedNow = pendingPayloadsRef.current.get(setId);
      const newerPending =
        stagedNow && stagedNow !== payload ? stagedNow : null;
      if (!newerPending) pendingPayloadsRef.current.delete(setId);

      if (isNew && realId !== setId) {
        // Record the swap so the settle callback can find the live id.
        tempToRealRef.current.set(setId, realId);
        // Carry any newer pending payload (staged under the TEMP id) over to
        // the real id so the rerun persists it as an UPDATE against the just-
        // inserted row. Force the name/description to what we just inserted:
        // the newer slice was built before this set had a baseline, so its
        // name/description are not authoritative.
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
        // Baseline the just-inserted set to EXACTLY the slice we sent.
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
        // Rekey the save-status maps from temp id to real id.
        saveStatus.markSaved(setId);
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
        baselineRef.current.set(setId, {
          ...persisted,
          name: payload.name,
          description: payload.description,
          sections: payload.sections.map(cloneSectionDeep),
        });
      }
      return { outcome: { ok: true } };
    },
    [machineId, mutateSets, saveStatus]
  );

  const saveQueue = useSettingsSaveQueue(execute);

  // -- runSave: the single point where persist is called and status tracked ----
  const runSave = useCallback(
    (id: string): void => {
      saveStatus.markPending(id);
      void saveQueue.persist(id).then((o) => {
        if (o.ok) {
          saveStatus.markSaved(id);
          autoRetried.current.delete(id);
          return;
        }
        saveStatus.markFailed(id);
        if (!autoRetried.current.has(id)) {
          autoRetried.current.add(id);
          retryTimers.current.set(
            id,
            setTimeout(() => {
              retryTimers.current.delete(id);
              runSaveRef.current(id); // ONE automatic retry; then manual only
            }, 5000)
          );
        }
      });
    },
    [saveStatus, saveQueue]
  );
  runSaveRef.current = runSave;

  // Clear all retry timers on unmount.
  useEffect(
    () => () => {
      for (const t of retryTimers.current.values()) clearTimeout(t);
      retryTimers.current.clear();
    },
    []
  );

  // -- Auto-save debounce (800 ms) --------------------------------------------
  const autoSave = useAutoSave(runSave);

  // -- Stage the working copy as the pending payload (C1 discipline) -----------
  // Every auto-save trigger does: stagePayload(setId) THEN autoSave.schedule/flush.
  // `execute` reads pendingPayloadsRef — DO NOT self-snapshot inside execute.
  function stagePayload(setId: string): void {
    const set = setsRef.current.find((s) => s.id === setId);
    if (!set) return;
    // Prune fully-empty rows from each section before staging so they don't
    // persist (Step 10 — empty-row prune on flush).
    const sections = set.sections.map(pruneEmptyRows);
    pendingPayloadsRef.current.set(setId, {
      name: set.name,
      description: set.description,
      sections: sections.map(cloneSectionDeep),
    });
  }

  // -- Nav guard: arm on pending or failed saves ------------------------------
  useUnsavedChangesGuard(canEdit && saveStatus.hasUnsaved);

  // beforeunload: attempt to flush pending debounces (async writes may not
  // complete on unload — the nav guard is the real protection).
  useEffect(() => {
    const handler = (): void => {
      autoSave.flushAll();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [autoSave]);

  // The preferred set is always pinned to the top. A stable sort preserves the
  // insertion order of everything else.
  const orderedSets = [...sets].sort(
    (a, b) => Number(b.isPreferred) - Number(a.isPreferred)
  );

  function removeLocal(id: string): void {
    mutateSets((prev) => prev.filter((s) => s.id !== id));
    baselineRef.current.delete(id);
    pendingPayloadsRef.current.delete(id);
    autoSave.cancel(id);
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
    if (newIds.has(id)) return;
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
    // Preferred is a row flag, not an auto-save slice — update both working
    // copy and baseline so it never reads as a pending edit.
    const apply = (s: SettingsSetData): SettingsSetData => ({
      ...s,
      isPreferred: s.id === id ? next : next ? false : s.isPreferred,
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
    if (newIds.has(id)) return;
    const original = sets.find((s) => s.id === id);
    if (!original) return;
    const result = await duplicateSettingsSetAction({ id });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
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
    baselineRef.current.set(copy.id, cloneSet(copy));
  }

  async function deleteSet(id: string): Promise<void> {
    if (newIds.has(id)) {
      removeLocal(id);
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
  }

  function updateDescription(id: string, value: ProseMirrorDoc | null): void {
    mutateSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, description: value } : s))
    );
    stagePayload(id);
    autoSave.schedule(id);
  }

  // -- Section-level working-copy mutations ------------------------------------
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
    // A new section is immediately in the working copy — no separate edit mode.
    // The auto-save will include it when the user types into it.
  }

  // -- Immediate structural ops (delete section / reorder) --------------------
  // These persist RIGHT AWAY from the WORKING COPY (Step 8b / H1).
  // All three ops: apply to working copy, stage from working copy, flush.

  function deleteSection(setId: string, sectionId: string): void {
    // Working copy: drop the section.
    mapSections(setId, (sections) =>
      sections.filter((sec) => sec.id !== sectionId)
    );
    const baseline = baselineRef.current.get(setId);
    if (!baseline) return; // never-saved set: nothing to persist
    // Update the baseline to match (remove the same section).
    const nextBaseline: SettingsSetData = {
      ...baseline,
      sections: baseline.sections.filter((sec) => sec.id !== sectionId),
    };
    baselineRef.current.set(setId, nextBaseline);
    // Stage from the working copy (which already has the section removed), then
    // flush immediately.
    stagePayload(setId);
    autoSave.flush(setId);
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
    // Apply reorder to working copy.
    mapSections(setId, reorder);

    const baseline = baselineRef.current.get(setId);
    if (!baseline) return; // never-saved set: order is local until first save
    // Update the baseline order too.
    const nextBaseline: SettingsSetData = {
      ...baseline,
      sections: reorder(baseline.sections),
    };
    baselineRef.current.set(setId, nextBaseline);
    // Stage from the working copy (with reordered sections) and flush.
    stagePayload(setId);
    autoSave.flush(setId);
  }

  // Keyboard / mobile reorder path (WCAG 2.2 SC 2.5.7).
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
    // Stage from the working copy and flush.
    stagePayload(setId);
    autoSave.flush(setId);
  }

  // -- Software / table row working-copy mutations ----------------------------
  function updateBaseline(
    setId: string,
    sectionId: string,
    baseline: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "software" ? { ...sec, baseline } : sec
    );
    stagePayload(setId);
    autoSave.schedule(setId);
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
    stagePayload(setId);
    autoSave.schedule(setId);
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
    stagePayload(setId);
    autoSave.flush(setId);
  }

  function updateTableTitle(
    setId: string,
    sectionId: string,
    title: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "table" ? { ...sec, title } : sec
    );
    stagePayload(setId);
    autoSave.schedule(setId);
  }

  // -- DIP switch working-copy mutations --------------------------------------
  function renameDipBank(setId: string, sectionId: string, name: string): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "dip" ? { ...sec, name } : sec
    );
    stagePayload(setId);
    autoSave.schedule(setId);
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
    stagePayload(setId);
    autoSave.schedule(setId);
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
    stagePayload(setId);
    autoSave.flush(setId);
  }

  // -- Note section working-copy mutations ------------------------------------
  function updateNoteTitle(
    setId: string,
    sectionId: string,
    title: string
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "note" ? { ...sec, title } : sec
    );
    stagePayload(setId);
    autoSave.schedule(setId);
  }

  function updateNoteBody(
    setId: string,
    sectionId: string,
    body: ProseMirrorDoc | null
  ): void {
    updateSection(setId, sectionId, (sec) =>
      sec.kind === "note" ? { ...sec, body } : sec
    );
    stagePayload(setId);
    // Rich-text is DEBOUNCE-ONLY: no blur-flush path (RichTextEditor has no
    // onBlur). The 800 ms schedule is the only save trigger for note bodies.
    autoSave.schedule(setId);
  }

  // onSectionBlurFlush: called from a section's blur callback (plain-text
  // fields only) to flush the debounce immediately on focus-leave.
  function onSectionBlurFlush(setId: string, _sectionId: string): void {
    stagePayload(setId);
    autoSave.flush(setId);
  }

  return (
    <div className="space-y-4 max-md:space-y-2.5">
      {/* Failure-only banner. Retry re-enqueues all failed sets. */}
      <SaveFailureBanner
        failedCount={saveStatus.failedIds.size}
        onRetry={() => {
          for (const id of saveStatus.failedIds) {
            stagePayload(id);
            runSave(id);
          }
        }}
      />

      {/* SECTION 1 — the owner's requests ("Before you change anything"). */}
      <InlineEditableField
        label="Before you change anything"
        value={settingsRequests}
        machineId={machineId}
        canEdit={canEdit}
        placeholder="How would you like people to handle your machine's settings — who to ask, how to make changes, anything to avoid? Even one sentence protects the setup you've dialed in."
        testId="machine-settings-requests"
        openWhenEmpty
        headingProminent
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

      {/* SECTION 2 — machine-level access instructions ("How to change settings"). */}
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
        <div className="space-y-3 max-md:space-y-2">
          {orderedSets.map((set) => (
            <SettingsSetCard
              key={set.id}
              set={set}
              isExpanded={expandedIds.has(set.id)}
              canEdit={canEdit}
              isNew={newIds.has(set.id)}
              onNameBlur={() => {
                stagePayload(set.id);
                autoSave.flush(set.id);
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
                stagePayload(set.id);
                autoSave.schedule(set.id);
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
              onSectionBlurFlush={(sectionId) => {
                onSectionBlurFlush(set.id, sectionId);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
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
