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

interface UnsavedChangesGuardArgs {
  /** Permission to edit — when false the guard does nothing. */
  enabled: boolean;
  /** A save has genuinely failed (the one unrecoverable case → prompt). */
  hasFailed: boolean;
  /** Any unflushed/pending/failed state — flush-on-nav protects these. */
  hasUnsaved: boolean;
  /** Fire-and-forget flush of every pending debounced save. */
  flushAll: () => void;
}

/**
 * Navigation guard for the auto-save settings editor (PP-43q3). Makes leaving
 * the page durable per the researched pattern:
 *
 *  - In-app soft navigation (a capturing document `click` on an in-app `<a>`):
 *    if a save has FAILED, prompt before leaving (the one case where leaving
 *    loses data we can't silently recover). Otherwise, when there are unsaved
 *    edits, FLUSH them (fire-and-forget) and let navigation proceed with NO
 *    prompt — soft navigation only unmounts the tab, so the in-flight server
 *    action survives and completes in the background.
 *  - `popstate` (browser back/forward): same logic. There is no reliable
 *    synchronous way to block a popstate, so a fire-and-forget flush is the
 *    only protection we can offer there.
 *  - `beforeunload` (tab close / hard reload): native prompt when unsaved, plus
 *    a best-effort flush (async writes may not complete on unload — this is the
 *    weakest path; the flush-on-nav + popstate handlers are the real coverage).
 *
 * Why a GLOBAL capturing listener (+ popstate + beforeunload) rather than a
 * per-`<Link>` `onNavigate` (Next 15.3+): the guard must catch EVERY navigation
 * out of the tab, and we can't wrap every `<Link>` in the app. `onNavigate` is
 * per-Link, so global capture is the only comprehensive choice.
 *
 * NO-DELAY CONTRACT (ratified by Tim): `flushAll()` on the nav/popstate path is
 * fire-and-forget — it kicks off the save(s) and returns in the same tick.
 * NEVER await the flush or hold navigation pending a save result.
 */
function useUnsavedChangesGuard({
  enabled,
  hasFailed,
  hasUnsaved,
  flushAll,
}: UnsavedChangesGuardArgs): void {
  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (!hasUnsaved) return;
      // Modern browsers show the native prompt on preventDefault alone.
      e.preventDefault();
      // Best-effort: async writes may not complete on unload.
      flushAll();
    };

    const onPopState = (): void => {
      // No reliable synchronous block for popstate exists — flush is the
      // protection. The navigation proceeds regardless (fire-and-forget).
      if (hasUnsaved) flushAll();
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

      if (hasFailed) {
        // The one prompt case: a save already FAILED, so leaving loses it.
        const ok = window.confirm(
          "A settings change failed to save. Leave and lose it?"
        );
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (hasUnsaved) {
        // Pending/dirty (but not failed): flush and leave silently — NO prompt.
        flushAll();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [enabled, hasFailed, hasUnsaved, flushAll]);
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
        // dirtyIds was keyed under the temp id; rekey it. markClean(realId)
        // alone would miss the temp id and leak it forever (permanently arming
        // the nav guard). Clear the temp id, then re-dirty under the real id
        // only if a newer edit landed mid-insert.
        saveStatus.markClean(setId);
        if (newerPending) saveStatus.markDirty(realId);
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
      // If no newer edit landed during the await, the working copy still
      // matches the persisted payload — mark it clean so the guard disarms.
      if (!newerPending) saveStatus.markClean(setId);
      return { outcome: { ok: true } };
    },
    [machineId, mutateSets, saveStatus]
  );

  const saveQueue = useSettingsSaveQueue(execute);

  // -- runSave: the single point where persist is called and status tracked ----
  const runSave = useCallback(
    (id: string): void => {
      // Cancel any queued auto-retry for this id so an explicit banner Retry (or
      // a fresh debounce flush) supersedes the 5 s timer and never double-settles.
      const pending = retryTimers.current.get(id);
      if (pending !== undefined) {
        clearTimeout(pending);
        retryTimers.current.delete(id);
      }
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
  // useAutoSave FLUSHES pending debounced saves on unmount (durability — Task 9),
  // so an in-app navigation mid-debounce still persists silently; the fired
  // server action survives the tab unmount and completes in the background.
  const autoSave = useAutoSave(runSave);
  // Stable flush handle for the nav guard (the `autoSave` object is a fresh
  // literal each render; `flushAll` is referentially stable).
  const { flushAll } = autoSave;

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

  // -- The single per-set edit pipeline (PP-43q3 Task 8) ----------------------
  // The ONLY place field handlers mutate a set. Ensures dirty tracking can't
  // drift and staging always reads the just-mutated working copy (C1 discipline).
  function editSet(
    setId: string,
    mutate: (set: SettingsSetData) => SettingsSetData,
    opts?: { flush?: boolean }
  ): void {
    mutateSets((prev) => prev.map((s) => (s.id === setId ? mutate(s) : s)));
    saveStatus.markDirty(setId);
    stagePayload(setId);
    if (opts?.flush === true) autoSave.flush(setId);
    else autoSave.schedule(setId);
  }

  // -- Nav guard: flush on dirty/pending nav, prompt only on a FAILED save ----
  // The single coherent beforeunload + popstate + capturing-click handler lives
  // inside the hook (consolidated — no duplicate beforeunload listener here).
  useUnsavedChangesGuard({
    enabled: canEdit,
    hasFailed: saveStatus.failedIds.size > 0,
    hasUnsaved: saveStatus.hasUnsaved,
    flushAll,
  });

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
    editSet(id, (s) => ({ ...s, name }));
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
    editSet(id, (s) => ({ ...s, description: value }));
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
    const baseline = baselineRef.current.get(setId);
    if (!baseline) return; // never-saved set: nothing to persist
    // editSet mutates the working copy, marks dirty, stages from the working
    // copy (C1), and flushes immediately. Baseline advances only in execute on
    // a successful save — no manual pre-advance (H1 fix).
    editSet(
      setId,
      (s) => ({
        ...s,
        sections: s.sections.filter((sec) => sec.id !== sectionId),
      }),
      { flush: true }
    );
  }

  function reorderSections(
    setId: string,
    activeId: string,
    overId: string
  ): void {
    const baseline = baselineRef.current.get(setId);
    if (!baseline) return; // never-saved set: order is local until first save
    // editSet mutates the working copy, marks dirty, stages from the working
    // copy (C1), and flushes immediately. Baseline advances only in execute on
    // a successful save — no manual pre-advance (H1 fix).
    editSet(
      setId,
      (s) => {
        const oldIndex = s.sections.findIndex((sec) => sec.id === activeId);
        const newIndex = s.sections.findIndex((sec) => sec.id === overId);
        if (oldIndex < 0 || newIndex < 0) return s;
        return { ...s, sections: arrayMove(s.sections, oldIndex, newIndex) };
      },
      { flush: true }
    );
  }

  // Keyboard / mobile reorder path (WCAG 2.2 SC 2.5.7).
  function moveSection(
    setId: string,
    sectionId: string,
    direction: "up" | "down"
  ): void {
    const baseline = baselineRef.current.get(setId);
    if (!baseline) return;
    // editSet mutates the working copy, marks dirty, stages from the working
    // copy (C1), and flushes immediately. Baseline advances only in execute on
    // a successful save — no manual pre-advance (H1 fix).
    editSet(
      setId,
      (s) => {
        const index = s.sections.findIndex((sec) => sec.id === sectionId);
        if (index < 0) return s;
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= s.sections.length) return s;
        return { ...s, sections: arrayMove(s.sections, index, target) };
      },
      { flush: true }
    );
  }

  // -- Software / table row working-copy mutations ----------------------------
  function updateBaseline(
    setId: string,
    sectionId: string,
    newBaseline: string
  ): void {
    editSet(setId, (s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId && sec.kind === "software"
          ? { ...sec, baseline: newBaseline }
          : sec
      ),
    }));
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
    editSet(setId, (s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId &&
        (sec.kind === "software" || sec.kind === "table")
          ? {
              ...sec,
              rows: sec.rows.map((r) =>
                r._key === rowKey ? { ...r, [field]: value } : r
              ),
            }
          : sec
      ),
    }));
  }

  function deleteSoftwareRow(
    setId: string,
    sectionId: string,
    rowKey: string
  ): void {
    editSet(
      setId,
      (s) => ({
        ...s,
        sections: s.sections.map((sec) =>
          sec.id === sectionId &&
          (sec.kind === "software" || sec.kind === "table")
            ? { ...sec, rows: sec.rows.filter((r) => r._key !== rowKey) }
            : sec
        ),
      }),
      { flush: true }
    );
  }

  function updateTableTitle(
    setId: string,
    sectionId: string,
    title: string
  ): void {
    editSet(setId, (s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId && sec.kind === "table" ? { ...sec, title } : sec
      ),
    }));
  }

  // -- DIP switch working-copy mutations --------------------------------------
  function renameDipBank(setId: string, sectionId: string, name: string): void {
    editSet(setId, (s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId && sec.kind === "dip" ? { ...sec, name } : sec
      ),
    }));
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
    editSet(setId, (s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId && sec.kind === "dip"
          ? {
              ...sec,
              switches: sec.switches.map((sw) =>
                sw._key === switchKey ? { ...sw, [field]: value } : sw
              ),
            }
          : sec
      ),
    }));
  }

  function deleteDipSwitch(
    setId: string,
    sectionId: string,
    switchKey: string
  ): void {
    editSet(
      setId,
      (s) => ({
        ...s,
        sections: s.sections.map((sec) =>
          sec.id === sectionId && sec.kind === "dip"
            ? {
                ...sec,
                switches: sec.switches.filter((sw) => sw._key !== switchKey),
              }
            : sec
        ),
      }),
      { flush: true }
    );
  }

  // -- Note section working-copy mutations ------------------------------------
  function updateNoteTitle(
    setId: string,
    sectionId: string,
    title: string
  ): void {
    editSet(setId, (s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId && sec.kind === "note" ? { ...sec, title } : sec
      ),
    }));
  }

  function updateNoteBody(
    setId: string,
    sectionId: string,
    body: ProseMirrorDoc | null
  ): void {
    // Rich-text is DEBOUNCE-ONLY: no blur-flush path (RichTextEditor has no
    // onBlur). The 800 ms schedule is the only save trigger for note bodies.
    editSet(setId, (s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId && sec.kind === "note" ? { ...sec, body } : sec
      ),
    }));
  }

  // onSectionBlurFlush: called from a section's blur callback (plain-text fields
  // AND now rich-text bodies via RichTextEditor's onBlur) to flush the debounce
  // immediately on focus-leave.
  function onSectionBlurFlush(setId: string, _sectionId: string): void {
    stagePayload(setId);
    autoSave.flush(setId);
  }

  // onSetBlurFlush: flush this set's debounce immediately on focus-leave. Used
  // by the header description's rich-text onBlur (symmetric with plain-text
  // fields, which flush on blur) — rich text KEEPS its debounce AND flushes.
  function onSetBlurFlush(setId: string): void {
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
              onDescriptionBlur={() => {
                onSetBlurFlush(set.id);
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
