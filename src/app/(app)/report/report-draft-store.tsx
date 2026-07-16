"use client";

import * as React from "react";
import type { MachineOption } from "~/components/machines/MachineCombobox";
import {
  parseDraft,
  serializeDraft,
  defaultEntry,
  emptySingle,
  DRAFT_VERSION,
  REPORT_DRAFT_KEY,
  LEGACY_DRAFT_KEY,
  type SharedEntry,
  type SingleOnlyState,
} from "./report-draft-schema";

export type { SharedEntry, SingleOnlyState };

export interface Assignee {
  id: string;
  name: string | null;
}

/** A draft entry counts as "content" (for the lock + ready counts) once it has
 *  a machine or a non-blank title. The auto-maintained trailing blank does not. */
export function entryHasContent(e: SharedEntry): boolean {
  return Boolean(e.machineId || e.title.trim());
}

interface ReportDraftValue {
  machines: MachineOption[];
  assignees: Assignee[];
  entries: SharedEntry[];
  single: SingleOnlyState;
  /** Number of entries with real content — drives the "2+ disables Single" lock. */
  contentRowCount: number;
  patchEntry: (index: number, next: Partial<SharedEntry>) => void;
  setEntries: (updater: (prev: SharedEntry[]) => SharedEntry[]) => void;
  patchSingle: (next: Partial<SingleOnlyState>) => void;
  /** Reset entry #1 to blank with a fresh idempotency key (post-submit / Clear). */
  resetEntryZero: () => void;
  /** Wipe the whole draft back to a single blank entry + empty single-only. */
  clearAll: () => void;
  /** Suppress persistence after a successful submit (mirrors the old forms). */
  markSubmitted: () => void;
}

const ReportDraftContext = React.createContext<ReportDraftValue | null>(null);

function blankEntry(): SharedEntry {
  return defaultEntry(crypto.randomUUID());
}

interface ReportDraftProviderProps {
  machines: MachineOption[];
  assignees: Assignee[];
  children: React.ReactNode;
}

export function ReportDraftProvider({
  machines,
  assignees,
  children,
}: ReportDraftProviderProps): React.JSX.Element {
  // SSR-safe: start blank, hydrate from localStorage after mount so the server
  // and first client render match.
  const [entries, setEntriesState] = React.useState<SharedEntry[]>(() => [
    blankEntry(),
  ]);
  const [single, setSingle] = React.useState<SingleOnlyState>(() =>
    emptySingle()
  );
  const hasRestored = React.useRef(false);
  // Skip the next persist run once — set after a successful submit or an
  // explicit Clear, so neither re-writes a draft we just intentionally cleared.
  const suppressPersist = React.useRef(false);

  // Hydrate once from the persisted draft (migrating the legacy key if present).
  React.useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    if (typeof window === "undefined") return;

    let raw = window.localStorage.getItem(REPORT_DRAFT_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_DRAFT_KEY);
      if (legacy) raw = legacy;
    }
    const draft = parseDraft(raw);
    if (!draft) {
      // Corrupt/absent — clear both keys so a poisoned draft can't linger.
      window.localStorage.removeItem(REPORT_DRAFT_KEY);
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
      return;
    }
    // Drop a stale machineId that no longer exists in the current list, so a
    // deleted/other-tenant machine can't silently ride along (PP-lql).
    const validIds = new Set(machines.map((m) => m.value));
    const restored = draft.entries.map((e) =>
      e.machineId && !validIds.has(e.machineId) ? { ...e, machineId: "" } : e
    );
    setEntriesState(restored.length > 0 ? restored : [blankEntry()]);
    setSingle(draft.single);
    // Retire the legacy key now that it's folded into the unified draft.
    window.localStorage.removeItem(LEGACY_DRAFT_KEY);
  }, [machines]);

  // Persist on change (skip after a successful submit — the next fresh report
  // starts clean, matching unified-report-form.tsx / quick-report-grid.tsx).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasRestored.current) return;
    if (suppressPersist.current) {
      suppressPersist.current = false;
      return;
    }
    window.localStorage.setItem(
      REPORT_DRAFT_KEY,
      serializeDraft({ version: DRAFT_VERSION, entries, single })
    );
  }, [entries, single]);

  const patchEntry = React.useCallback(
    (index: number, next: Partial<SharedEntry>): void =>
      setEntriesState((prev) =>
        prev.map((e, i) => (i === index ? { ...e, ...next } : e))
      ),
    []
  );

  const setEntries = React.useCallback(
    (updater: (prev: SharedEntry[]) => SharedEntry[]): void =>
      setEntriesState(updater),
    []
  );

  const patchSingle = React.useCallback(
    (next: Partial<SingleOnlyState>): void =>
      setSingle((prev) => ({ ...prev, ...next })),
    []
  );

  const resetEntryZero = React.useCallback((): void => {
    setEntriesState((prev) => {
      const rest = prev.slice(1);
      return [blankEntry(), ...rest];
    });
  }, []);

  const clearAll = React.useCallback((): void => {
    // Suppress the persist that the blank-entry state change would otherwise
    // trigger, so storage stays cleared until the user types again.
    suppressPersist.current = true;
    setEntriesState([blankEntry()]);
    setSingle(emptySingle());
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(REPORT_DRAFT_KEY);
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
    }
  }, []);

  const markSubmitted = React.useCallback((): void => {
    suppressPersist.current = true;
  }, []);

  const contentRowCount = entries.filter(entryHasContent).length;

  const value = React.useMemo<ReportDraftValue>(
    () => ({
      machines,
      assignees,
      entries,
      single,
      contentRowCount,
      patchEntry,
      setEntries,
      patchSingle,
      resetEntryZero,
      clearAll,
      markSubmitted,
    }),
    [
      machines,
      assignees,
      entries,
      single,
      contentRowCount,
      patchEntry,
      setEntries,
      patchSingle,
      resetEntryZero,
      clearAll,
      markSubmitted,
    ]
  );

  return (
    <ReportDraftContext.Provider value={value}>
      {children}
    </ReportDraftContext.Provider>
  );
}

export function useReportDraft(): ReportDraftValue {
  const ctx = React.useContext(ReportDraftContext);
  if (!ctx) {
    throw new Error("useReportDraft must be used within a ReportDraftProvider");
  }
  return ctx;
}
