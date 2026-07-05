"use client";

import { useCallback, useRef } from "react";

/**
 * Outcome of a persist, handed back to the caller (auto-save flush, or a
 * structural op) so it can settle its save-status tracking without knowing
 * anything about the whole-row persist underneath.
 */
export type SaveOutcome = { ok: true } | { ok: false; error: string };

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
 * Per-set serial save queue for the Machine Settings editor (PP-43q3
 * always-live auto-save model).
 *
 * Every auto-save flush (debounced 800 ms or immediate on blur/structural op)
 * calls `persist(setId)`, which writes the whole row via `saveSettingsSetAction`
 * (the jsonb schema is unchanged — see settings/actions.ts). The queue enforces
 * two invariants: (1) at most one in-flight save per set at any time, preventing
 * a slow write from landing after a newer one and reverting it; (2) concurrent
 * calls collapse into exactly one follow-up run that sends the latest staged
 * snapshot, so a burst of rapid edits never produces a stampede.
 *
 * On a new set's first persist, `execute` returns `rekeyTo` with the
 * server-assigned UUID; the queue moves the entry from the temp id to the real
 * id and keeps draining under the real id, so coalesced follow-up edits UPDATE
 * the correct row.
 *
 * State lives in a ref (not React state) on purpose: the queue is pure control
 * flow with no render output of its own — save-status feedback lives in
 * `useSaveStatus`, driven by the promise this hook returns.
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

    // Settle everyone waiting on this set with the final outcome. The entry
    // stays in the map (every persist registers a waiter, so it's never empty
    // here) and is reclaimed by `forget()` when the set is deleted; a lingering
    // idle entry is just `{ inFlight: false, waiters: [] }` and is reused by the
    // set's next save.
    const waiters = queue.waiters;
    queue.waiters = [];
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
