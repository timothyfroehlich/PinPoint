"use client";

import { useCallback, useRef } from "react";

/**
 * Outcome of a persist, handed back to the caller (a unit's Save, or a
 * structural op) so it can settle its saving / error UI without knowing anything
 * about the whole-row persist underneath.
 */
export type SaveOutcome = { ok: true } | { ok: false; error: string };

/**
 * The in-flight save state of one edit UNIT (PP-43q3 atomic per-unit commit),
 * surfaced next to that unit's Save button. `saving` flips on while its atomic
 * write awaits the server; `error` holds the last failure (the unit stays open
 * with the typed values intact, and the Save button doubles as Retry).
 */
export interface UnitSaveState {
  saving: boolean;
  error: string | null;
}

/**
 * Result of one whole-row persist. `rekeyTo` is set only when a brand-new set's
 * first insert just minted a server UUID: the queue then moves this set's entry
 * from its temp id to the real id and keeps draining under the real id, so any
 * coalesced follow-up edit persists as an UPDATE against the right row.
 */
export interface SaveExecutorResult {
  outcome: SaveOutcome;
  rekeyTo?: string;
}

/**
 * The whole-row persist for one set. `setId` is the CURRENT id of the set (a
 * temp id for a never-saved set). The executor reads the freshest working copy
 * itself (SettingsTab passes one that snapshots `sets` through a ref), persists
 * via `saveSettingsSetAction`, and returns the outcome (plus an optional
 * temp→real id swap to apply).
 */
type SaveExecutor = (setId: string) => Promise<SaveExecutorResult>;

interface PerSetQueue {
  /** A save is currently awaiting the server for this set. */
  inFlight: boolean;
  /**
   * Commits arrived while a save was in flight, so the latest snapshot still
   * needs to go out. Drained by one more run after the in-flight save settles.
   */
  rerunQueued: boolean;
  /**
   * Resolvers for every `persist()` caller still waiting on a settled save.
   * They all resolve with the outcome of whichever run finally flushes the
   * snapshot that superseded them — the latest snapshot always wins, so a
   * coalesced batch reports one shared, accurate result.
   */
  waiters: ((outcome: SaveOutcome) => void)[];
}

interface UseSettingsSaveQueueResult {
  /**
   * Enqueue a whole-row save of `setId`'s current working copy. Returns a
   * promise that settles when this set next reaches a quiescent persisted state
   * (this commit's snapshot, or a later one that superseded it, has landed).
   * Overlapping commits are coalesced: at most one save per set is ever in
   * flight, and the next run always sends the latest snapshot, so rapid edits
   * can't complete out of order and clobber each other.
   */
  persist: (setId: string) => Promise<SaveOutcome>;
  /** Forget a set's queue entry (on delete). */
  forget: (setId: string) => void;
}

/**
 * Per-set serial save queue for the Machine Settings editor.
 *
 * Under the atomic per-unit commit model (PP-43q3) a set is persisted by a
 * unit's Save (the committed baseline with that unit's slice merged in) or by an
 * immediate structural op (delete section / reorder, computed from baseline).
 * Both go through this queue. Every persist writes the whole row (the jsonb
 * schema is unchanged — see settings/actions.ts). Two concerns the queue still
 * guards: a slow save landing AFTER a newer one and reverting it, and a burst of
 * saves firing a stampede of redundant whole-row writes. It holds at most one
 * in-flight save per set and, when saves pile up, collapses them into exactly
 * one follow-up run that sends the latest snapshot.
 *
 * State lives in a ref (not React state) on purpose: the queue is pure control
 * flow with no render output of its own — the per-field status lives in each
 * field, driven by the promise this hook returns.
 */
export function useSettingsSaveQueue(
  execute: SaveExecutor
): UseSettingsSaveQueueResult {
  const queues = useRef(new Map<string, PerSetQueue>());
  // Hold the executor in a ref so `persist` stays referentially stable across
  // renders (it closes over the ref, not the latest `execute` directly) while
  // still calling the freshest executor — which reads the freshest `sets`.
  const executeRef = useRef(execute);
  executeRef.current = execute;

  const drain = useCallback(async (setId: string): Promise<void> => {
    const queue = queues.current.get(setId);
    if (!queue || queue.inFlight) return;

    queue.inFlight = true;
    queue.rerunQueued = false;
    let result: SaveExecutorResult;
    try {
      result = await executeRef.current(setId);
    } catch {
      // Defensive: the executor is expected to convert failures into an
      // { ok: false } outcome, but never let a throw strand the waiters.
      result = {
        outcome: { ok: false, error: "Could not save. Please try again." },
      };
    }
    queue.inFlight = false;

    // A new set's first insert minted a real id: move this entry to the real id
    // and keep draining there, so coalesced follow-up edits UPDATE the right row.
    let key = setId;
    if (result.rekeyTo && result.rekeyTo !== setId) {
      queues.current.delete(setId);
      queues.current.set(result.rekeyTo, queue);
      key = result.rekeyTo;
    }

    // A follow-up was requested while this save was in flight: run exactly once
    // more with the now-latest snapshot before settling the waiters, so they
    // report the result of the snapshot that actually superseded them. Read the
    // flag back off the live map entry — a `persist()` during the await above
    // mutated it through the same reference, which the type-narrowing of the
    // top-of-function reset can't see.
    const rerun = queues.current.get(key)?.rerunQueued ?? false;
    if (rerun) {
      await drain(key);
      return;
    }

    const waiters = queue.waiters;
    queue.waiters = [];
    if (waiters.length === 0) {
      queues.current.delete(key);
    }
    for (const resolve of waiters) resolve(result.outcome);
  }, []);

  const persist = useCallback(
    (setId: string): Promise<SaveOutcome> => {
      let queue = queues.current.get(setId);
      if (!queue) {
        queue = { inFlight: false, rerunQueued: false, waiters: [] };
        queues.current.set(setId, queue);
      }
      const settled = new Promise<SaveOutcome>((resolve) => {
        queue.waiters.push(resolve);
      });
      // If a save is already running, just mark that another run is needed; the
      // in-flight drain will pick up the latest snapshot when it loops.
      if (queue.inFlight) {
        queue.rerunQueued = true;
      } else {
        void drain(setId);
      }
      return settled;
    },
    [drain]
  );

  const forget = useCallback((setId: string): void => {
    queues.current.delete(setId);
  }, []);

  return { persist, forget };
}
