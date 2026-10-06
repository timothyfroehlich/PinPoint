"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Info, Wrench, Check } from "lucide-react";
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
  BUILTIN_SETTINGS_TAG_NAMES,
  BUILTIN_SETTINGS_TAGS,
  NAME_MAX,
  type SettingsPreferredSlot,
  type SettingsSection,
  type SettingsSetData,
  type SettingsTagRef,
} from "~/lib/machines/settings-types";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { cn } from "~/lib/utils";
import {
  deleteSettingsSetAction,
  duplicateSettingsSetAction,
  makeCommunitySettingsSetAction,
  saveSettingsSetAction,
  setPreferredSettingsSetAction,
  setSettingsSetTagAction,
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
  /**
   * An EXPLICIT-save machine-level field (the two PP-8a5r InlineEditableField
   * sections) holds a dirty, uncommitted draft. Unlike the auto-save sets there
   * is nothing to flush — leaving silently loses the draft — so this PROMPTS
   * (like `hasFailed`) rather than flushing.
   */
  hasUnsavedDraft: boolean;
  /** Fire-and-forget persist of every not-yet-cleanly-saved set (status-driven,
   *  so it covers failed sets that have no live debounce timer). */
  flushUnsaved: () => void;
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
 * NO-DELAY CONTRACT (ratified by Tim): `flushUnsaved()` on the nav/popstate path
 * is fire-and-forget — it kicks off the save(s) and returns in the same tick.
 * NEVER await the flush or hold navigation pending a save result.
 */
function useUnsavedChangesGuard({
  enabled,
  hasFailed,
  hasUnsaved,
  hasUnsavedDraft,
  flushUnsaved,
}: UnsavedChangesGuardArgs): void {
  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      // Stay for either an unsaved auto-save set OR a dirty explicit-save draft.
      if (!hasUnsaved && !hasUnsavedDraft) return;
      // Modern browsers show the native prompt on preventDefault alone.
      e.preventDefault();
      // Best-effort flush of the auto-save sets; the explicit draft has nothing
      // to flush (its loss is what the native prompt warns about).
      flushUnsaved();
    };

    const onPopState = (): void => {
      // No reliable synchronous block for popstate exists — flush is the
      // protection. The navigation proceeds regardless (fire-and-forget). A
      // dirty explicit-save draft can't be blocked synchronously here and has
      // nothing to flush, so that loss is irreducible (same accepted class as
      // the auto-save popstate residual).
      if (hasUnsaved) flushUnsaved();
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

      if (hasFailed || hasUnsavedDraft) {
        // The prompt cases: a save already FAILED (leaving loses it), OR an
        // explicit-save machine-field draft is dirty (nothing to flush — leaving
        // loses it). hasFailed keeps its specific copy; a draft-only situation
        // uses the generic unsaved-changes message.
        const message = hasFailed
          ? "A settings change failed to save. Leave and lose it?"
          : "You have unsaved changes. Leave without saving?";
        const ok = window.confirm(message);
        if (!ok) {
          e.preventDefault();
          // Do not call e.stopPropagation() so component-level React onClick handlers
          // (like closing drawers or dropdown menus) still execute (PP-kny4).
        }
        return;
      }
      if (hasUnsaved) {
        // Pending/dirty (but not failed): flush and leave silently — NO prompt.
        flushUnsaved();
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
  }, [enabled, hasFailed, hasUnsaved, hasUnsavedDraft, flushUnsaved]);
}

/**
 * A built-in tag as the client shows it before the server's copy is reloaded.
 * The UI keys tags by slug, so the placeholder id never reaches the server.
 */
function builtinTagRef(slot: SettingsPreferredSlot): SettingsTagRef {
  return { id: slot, slug: slot, name: BUILTIN_SETTINGS_TAG_NAMES[slot] };
}

// Filter-chip styling. The category segment and the Tournament toggle are two
// DIFFERENT kinds of control, so they must not look alike: a solid fill means
// "this is the one selected category", while the independent toggle uses a
// checked outline. Rendering both as solid pills read as one multi-select row,
// which is how a stuck Tournament filter hid in plain sight (PP-tn6t review).
const chipClass =
  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors motion-reduce:transition-none";
const chipActive = "border-primary bg-primary text-primary-foreground";
const chipIdle = "border-outline-variant text-muted-foreground hover:bg-muted";
/** Independent toggle in its ON state — checked outline, never a solid fill. */
const chipToggleActive = "border-primary bg-primary/10 text-primary";

interface SettingsTabProps {
  /** Machine-wide gate: may this viewer CREATE a set + edit the machine-level
   *  guidance? Per-set edit rights live on each set's `canEdit`. */
  canCreate: boolean;
  /** The current viewer's user id (null if anonymous) — drives the "Mine"
   *  filter and the optimistic ownership of newly-created sets. */
  viewerId: string | null;
  /** The machine owner's user id — hides the redundant "Owner's" chip when the
   *  viewer IS the owner, and derives new-set ownership. */
  machineOwnerId: string | null;
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
  canCreate,
  viewerId,
  machineOwnerId,
  machineId,
  initialSets,
  settingsRequests,
  settingsInstructions,
}: SettingsTabProps): React.JSX.Element {
  const [sets, setSets] = useState<SettingsSetData[]>(initialSets);
  // Sets render COLLAPSED by default so every set can be scanned at once; the
  // user expands the ones they want to read.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  // Sets created this session that haven't been persisted yet (temp id). The
  // first auto-save inserts them and swaps the temp id for the server UUID.
  // Preferred/Duplicate target a persisted row, so they're gated on this.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // Category is single-select (All / Mine / Community); the House and
  // Tournament tag toggles are independent and AND with the category.
  //  · Mine       — created by the viewer
  //  · Community  — community sets (co-edited)
  // Other people's personal sets are hidden unless preferred, until the viewer
  // turns on "Others' personal" (machine-settings spec §2.5).
  const [category, setCategory] = useState<"all" | "mine" | "community">("all");
  const [tagFilters, setTagFilters] = useState<
    Record<SettingsPreferredSlot, boolean>
  >({ house: false, tournament: false });
  const [showOthersPersonal, setShowOthersPersonal] = useState(false);
  const anyTagFilter = tagFilters.house || tagFilters.tournament;

  // -- Dirty explicit-save machine-level drafts (PP-8a5r) ----------------------
  // The two machine-level InlineEditableField sections ("Before you change
  // anything" / "How to change settings") use EXPLICIT Save/Cancel — not the
  // auto-save machinery — so each holds its own dirty draft inside the component.
  // We mirror their dirtiness here (by field id) so the nav guard can PROMPT
  // before leaving with an uncommitted draft (there's nothing to flush). The
  // updater is referentially stable so the field's onDirtyChange effect (deps
  // include the callback) doesn't re-run in a loop.
  const [dirtyDraftIds, setDirtyDraftIds] = useState<Set<string>>(
    () => new Set()
  );
  const setDraftDirty = useCallback((id: string, dirty: boolean): void => {
    setDirtyDraftIds((prev) => {
      const has = prev.has(id);
      if (dirty === has) return prev; // no change → keep the same Set reference
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  // Stable per-field callbacks: the InlineEditableField onDirtyChange effect has
  // the callback in its dep array, so an inline closure would re-run it every
  // render. useCallback pins one identity per field.
  const onRequestsDirty = useCallback(
    (dirty: boolean): void => {
      setDraftDirty("machine:requests", dirty);
    },
    [setDraftDirty]
  );
  const onInstructionsDirty = useCallback(
    (dirty: boolean): void => {
      setDraftDirty("machine:instructions", dirty);
    },
    [setDraftDirty]
  );
  const hasUnsavedDraft = dirtyDraftIds.size > 0;

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
              ? {
                  ...s,
                  id: realId,
                  updatedBy: "You",
                  updatedById: viewerId,
                  updatedAt: today(),
                }
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
            s.id === setId
              ? {
                  ...s,
                  updatedBy: "You",
                  updatedById: viewerId,
                  updatedAt: today(),
                }
              : s
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
    [machineId, mutateSets, saveStatus, viewerId]
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
  // useAutoSave owns ONLY debounce timing (it cancels its timers on unmount).
  // Durability (flushing on every leaving path) is owned here by the
  // save-status-driven `flushUnsaved` below — not by the timer map, which
  // misses a set whose debounce already fired and whose save then FAILED.
  const autoSave = useAutoSave(runSave);

  // -- Leaving-flush: persist every NOT-yet-cleanly-saved set ------------------
  // Driven by save-status, NOT the debounce timer map. `dirtyIds` is the
  // complete superset of unsaved sets: markDirty adds on every edit, markClean
  // removes ONLY on a successful save, and markFailed leaves dirty intact — so a
  // failed set (which has no live timer) is still covered. We union failedIds
  // defensively. `autoSave.flush(id)` cancels any pending timer THEN persists,
  // so each id fires exactly once (no double-fire with the debounce).
  //
  // Held in a ref so the unmount effect (below) reads the CURRENT id sets with
  // no stale closure, and so the handle passed to the nav guard stays stable.
  //
  // NO-DELAY CONTRACT (Tim): fire-and-forget — kicks off the saves and returns
  // in the same tick. The fired server actions survive the tab unmount.
  const flushUnsavedRef = useRef<() => void>(() => undefined);
  flushUnsavedRef.current = (): void => {
    const ids = new Set<string>([
      ...saveStatus.dirtyIds,
      ...saveStatus.failedIds,
    ]);
    for (const id of ids) autoSave.flush(id);
  };
  const flushUnsaved = useCallback((): void => flushUnsavedRef.current(), []);

  // Flush — don't drop — every unsaved set when the tab unmounts (in-app
  // navigation that doesn't go through an <a>, e.g. switching machine tabs).
  // Runs once on unmount; reads current ids via the ref. Ordering vs
  // useAutoSave's own timer-clear cleanup does NOT matter: flushUnsaved persists
  // by STATUS (calling runSave per dirty id), independent of timer survival.
  useEffect(() => () => flushUnsavedRef.current(), []);

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
  // The leaving-flush is `flushUnsaved` (save-status-driven), NOT flushAll
  // (timer-only) — so a failed set with no live timer still re-persists on the
  // popstate / beforeunload / not-failed-click paths.
  useUnsavedChangesGuard({
    enabled: canCreate,
    hasFailed: saveStatus.failedIds.size > 0,
    hasUnsaved: saveStatus.hasUnsaved,
    hasUnsavedDraft,
    flushUnsaved,
  });

  // The preferred sets are always pinned to the top (House, then Tournament).
  // A stable sort preserves the insertion order of everything else.
  const orderedSets = [...sets].sort(
    (a, b) =>
      Number(b.isPreferredHouse) - Number(a.isPreferredHouse) ||
      Number(b.isPreferredTournament) - Number(a.isPreferredTournament)
  );
  const isMine = (s: SettingsSetData): boolean =>
    viewerId !== null && s.createdById === viewerId;
  const isOthersPersonal = (s: SettingsSetData): boolean =>
    !s.isCommunity &&
    !isMine(s) &&
    !s.isPreferredHouse &&
    !s.isPreferredTournament;
  const hasTag = (s: SettingsSetData, slot: SettingsPreferredSlot): boolean =>
    s.tags.some((t) => t.slug === slot);
  // The pool every chip counts and filters over: all sets, less other people's
  // personal sets unless the viewer asked for them.
  const pool = orderedSets.filter(
    (s) => showOthersPersonal || !isOthersPersonal(s)
  );
  const matchesCategory = (s: SettingsSetData): boolean => {
    switch (category) {
      case "mine":
        return isMine(s);
      case "community":
        return s.isCommunity;
      case "all":
        return true;
    }
  };
  const matchesFilter = (s: SettingsSetData): boolean =>
    matchesCategory(s) &&
    BUILTIN_SETTINGS_TAGS.every((slot) => !tagFilters[slot] || hasTag(s, slot));
  const visibleSets = pool.filter(matchesFilter);
  const mineCount = pool.filter(isMine).length;
  const communityCount = pool.filter((s) => s.isCommunity).length;
  const tagCounts: Record<SettingsPreferredSlot, number> = {
    house: pool.filter((s) => hasTag(s, "house")).length,
    tournament: pool.filter((s) => hasTag(s, "tournament")).length,
  };
  const othersPersonalCount = sets.filter(isOthersPersonal).length;

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

  // Row-level flags (preferred, kind, tags) are not auto-save slices: write them
  // to the working copy AND every baseline so they never read as pending edits.
  function applyRowChange(
    apply: (s: SettingsSetData) => SettingsSetData
  ): void {
    mutateSets((prev) => prev.map(apply));
    for (const [bid, b] of baselineRef.current) {
      baselineRef.current.set(bid, apply(b));
    }
  }

  async function togglePreferred(
    id: string,
    slot: SettingsPreferredSlot
  ): Promise<void> {
    if (newIds.has(id)) return;
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    const key = slot === "house" ? "isPreferredHouse" : "isPreferredTournament";
    const next = !set[key];
    const result = await setPreferredSettingsSetAction({
      id,
      slot,
      preferred: next,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    // Exclusive per slot; a set made preferred becomes a community set, so the
    // viewer's rights on it follow the community rules from now on: curators
    // edit and delete it (admins, who alone delete any set, always curate), and
    // its author loses rights they held only as author.
    applyRowChange((s) => {
      if (s.id !== id) return next ? { ...s, [key]: false } : s;
      if (!next || s.isCommunity) return { ...s, [key]: next };
      return {
        ...s,
        [key]: true,
        isCommunity: true,
        canMakeCommunity: false,
        canEdit: s.canCurate,
        canDelete: s.canCurate,
      };
    });
  }

  async function toggleTag(
    id: string,
    slot: SettingsPreferredSlot
  ): Promise<void> {
    if (newIds.has(id)) return;
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    const applied = !hasTag(set, slot);
    const ref = builtinTagRef(slot);
    const write = (on: boolean): void => {
      applyRowChange((s) =>
        s.id !== id
          ? s
          : {
              ...s,
              tags: on
                ? [...s.tags.filter((t) => t.slug !== slot), ref]
                : s.tags.filter((t) => t.slug !== slot),
            }
      );
    };
    write(applied);
    const result = await setSettingsSetTagAction({ id, tag: slot, applied });
    if (!result.success) {
      toast.error(result.error);
      write(!applied);
    }
  }

  async function makeCommunity(id: string): Promise<void> {
    if (newIds.has(id)) return;
    const result = await makeCommunitySettingsSetAction({ id });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    applyRowChange((s) =>
      s.id !== id
        ? s
        : {
            ...s,
            isCommunity: true,
            canMakeCommunity: false,
            canEdit: s.canCurate,
            canDelete: s.canCurate,
          }
    );
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
      // A personal set of the duplicator, carrying the original's tags, never
      // preferred (machine-settings spec §4.5).
      isPreferredHouse: false,
      isPreferredTournament: false,
      isCommunity: false,
      tags: original.tags,
      createdById: viewerId,
      canEdit: true,
      canDelete: true,
      canMakeCommunity: true,
      canCurate: original.canCurate,
      updatedBy: "You",
      updatedById: viewerId,
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
    // Mirror the server's create rules optimistically (machine-settings spec
    // §2.1, §4.4): a personal set tagged House — unless the machine has no
    // preferred House set, when it becomes that, and so a community set.
    const autoPreferred = !sets.some((s) => s.isPreferredHouse);
    const newSet: SettingsSetData = {
      id,
      name: "",
      isPreferredHouse: autoPreferred,
      isPreferredTournament: false,
      isCommunity: autoPreferred,
      tags: [builtinTagRef("house")],
      createdById: viewerId,
      canEdit: true,
      canDelete: true,
      canMakeCommunity: !autoPreferred,
      canCurate: canCreate,
      updatedBy: "You",
      updatedById: viewerId,
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
    <div className="space-y-3 max-md:space-y-2.5">
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

      {/* The two machine-wide guidance callouts. Kept vertically compact
          (tight padding + gap) so they don't dominate the tab. */}
      <div className="flex flex-col gap-2">
        {/* SECTION 1 — the owner's requests ("Before you change anything"). */}
        <InlineEditableField
          label="Before you change anything"
          value={settingsRequests}
          machineId={machineId}
          canEdit={canCreate}
          icon={<Info className="size-4 shrink-0 text-primary" aria-hidden />}
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

        {/* SECTION 2 — machine-level access instructions ("How to change settings"). */}
        <InlineEditableField
          label="How to change settings"
          value={settingsInstructions}
          machineId={machineId}
          canEdit={canCreate}
          icon={<Wrench className="size-4 shrink-0 text-primary" aria-hidden />}
          placeholder="How to change the settings on this machine — menus, button meanings, where the DIP switches are. Or start from a preset above."
          testId="machine-settings-instructions"
          presets={SETTINGS_INSTRUCTIONS_PRESETS}
          openWhenEmpty
          headingProminent
          collapsible
          defaultOpen={false}
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter settings sets"
        >
          {/* Category — single-select (clicking the active one returns to All).
              "All" is the row's reset: it clears the category AND the tag
              toggles, because "All" reads as "no filters" and a user who
              clicks it expects to see every set again (PP-tn6t review). */}
          {(
            [
              { key: "all", label: "All", count: pool.length, show: true },
              {
                key: "mine",
                label: "Mine",
                count: mineCount,
                // Keep it rendered while it is the ACTIVE filter even at count
                // 0 — deleting your last set would otherwise pull the lit chip
                // out from under you, leaving an unexplained empty list.
                show:
                  viewerId !== null && (mineCount > 0 || category === "mine"),
              },
              {
                key: "community",
                label: "Community",
                count: communityCount,
                show: true,
              },
            ] as const
          )
            .filter((chip) => chip.show)
            .map((chip) => {
              // "All" only reads as selected when NOTHING is filtered.
              const active =
                chip.key === "all"
                  ? category === "all" && !anyTagFilter
                  : category === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    if (chip.key === "all") {
                      setCategory("all");
                      setTagFilters({ house: false, tournament: false });
                      return;
                    }
                    setCategory((c) => (c === chip.key ? "all" : chip.key));
                  }}
                  className={cn(chipClass, active ? chipActive : chipIdle)}
                >
                  {chip.label}{" "}
                  <span className={active ? "opacity-80" : "opacity-60"}>
                    {String(chip.count)}
                  </span>
                </button>
              );
            })}
          {/* Independent tag toggles (AND with the category). */}
          <span
            className="mx-1 h-4 w-px shrink-0 bg-outline-variant"
            aria-hidden
          />
          {BUILTIN_SETTINGS_TAGS.map((slot) => (
            <button
              key={slot}
              type="button"
              aria-pressed={tagFilters[slot]}
              onClick={() => {
                setTagFilters((f) => ({ ...f, [slot]: !f[slot] }));
              }}
              className={cn(
                chipClass,
                tagFilters[slot] ? chipToggleActive : chipIdle
              )}
            >
              {tagFilters[slot] && (
                <Check className="size-3" aria-hidden="true" />
              )}
              {BUILTIN_SETTINGS_TAG_NAMES[slot]}{" "}
              <span className={tagFilters[slot] ? "opacity-80" : "opacity-60"}>
                {String(tagCounts[slot])}
              </span>
            </button>
          ))}
          {/* Other people's personal sets: hidden by default (spec §2.5). */}
          {(othersPersonalCount > 0 || showOthersPersonal) && (
            <button
              type="button"
              aria-pressed={showOthersPersonal}
              onClick={() => {
                setShowOthersPersonal((v) => !v);
              }}
              className={cn(
                chipClass,
                showOthersPersonal ? chipToggleActive : chipIdle
              )}
            >
              {showOthersPersonal && (
                <Check className="size-3" aria-hidden="true" />
              )}
              Others' personal{" "}
              <span
                className={showOthersPersonal ? "opacity-80" : "opacity-60"}
              >
                {String(othersPersonalCount)}
              </span>
            </button>
          )}
        </div>
        {canCreate && (
          <Button size="sm" onClick={addNewSet}>
            <Plus aria-hidden="true" />
            New set
          </Button>
        )}
      </div>

      {sets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant py-8 text-center text-sm text-muted-foreground">
          {canCreate ? (
            <>
              No settings sets yet. Click <strong>New set</strong> above to
              create one.
            </>
          ) : (
            "No settings sets recorded yet."
          )}
        </p>
      ) : visibleSets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant py-8 text-center text-sm text-muted-foreground">
          No settings sets match the current filters.
        </p>
      ) : (
        <div className="space-y-3 max-md:space-y-2">
          {visibleSets.map((set) => (
            <SettingsSetCard
              key={set.id}
              set={set}
              isExpanded={expandedIds.has(set.id)}
              canEdit={set.canEdit}
              updatedByIsOwner={
                machineOwnerId !== null && set.updatedById === machineOwnerId
              }
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
              onTogglePreferred={(slot) => {
                void togglePreferred(set.id, slot);
              }}
              onToggleTag={(slot) => {
                void toggleTag(set.id, slot);
              }}
              onMakeCommunity={() => {
                void makeCommunity(set.id);
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
