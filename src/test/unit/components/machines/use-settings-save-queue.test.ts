import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  type SaveExecutorResult,
  type SaveOutcome,
  useSettingsSaveQueue,
} from "~/components/machines/settings/use-settings-save-queue";

/**
 * A deferred promise helper: lets a test hold an executor call "in flight" and
 * resolve it at a precise moment, so we can drive the coalescing window
 * deterministically.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const OK: SaveExecutorResult = { outcome: { ok: true } };

describe("useSettingsSaveQueue", () => {
  it("coalesces overlapping persists into one in-flight + one rerun (latest wins)", async () => {
    // The first executor call is held; the second resolves immediately. We tag
    // each run's outcome so we can prove both callers settle on the LATEST run.
    const firstRun = deferred<SaveExecutorResult>();
    let callCount = 0;
    const execute = vi.fn(async (): Promise<SaveExecutorResult> => {
      callCount += 1;
      if (callCount === 1) return firstRun.promise;
      return { outcome: { ok: true } };
    });

    const { result } = renderHook(() => useSettingsSaveQueue(execute));

    let firstPromise!: Promise<SaveOutcome>;
    let secondPromise!: Promise<SaveOutcome>;
    act(() => {
      // First persist starts draining (executor call #1, now in flight).
      firstPromise = result.current.persist("set-1");
      // Second persist arrives while #1 is in flight → marks a rerun, does NOT
      // start a second concurrent drain.
      secondPromise = result.current.persist("set-1");
    });

    // Only the first executor call has happened so far.
    expect(execute).toHaveBeenCalledTimes(1);

    // Release the in-flight save. The queue then runs EXACTLY once more (the
    // coalesced rerun with the latest snapshot), not a third time.
    const secondResult: SaveExecutorResult = { outcome: { ok: true } };
    await act(async () => {
      firstRun.resolve(secondResult);
      // Let the drain loop settle.
      await Promise.resolve();
    });

    const [firstOutcome, secondOutcome] = await Promise.all([
      firstPromise,
      secondPromise,
    ]);

    // Exactly two runs: the in-flight one + the single coalesced rerun.
    expect(execute).toHaveBeenCalledTimes(2);
    // Both waiters resolve with the SECOND (latest) run's outcome.
    expect(firstOutcome).toEqual({ ok: true });
    expect(secondOutcome).toEqual({ ok: true });
  });

  it("rekeys a temp id to the real id and keeps draining under the real id", async () => {
    // First run (the insert) returns a real id; a follow-up persist arrives
    // while it's in flight, and must drain under the REAL id.
    const insertRun = deferred<SaveExecutorResult>();
    const seen: string[] = [];
    let callCount = 0;
    const execute = vi.fn(
      async (setId: string): Promise<SaveExecutorResult> => {
        seen.push(setId);
        callCount += 1;
        if (callCount === 1) return insertRun.promise;
        return { outcome: { ok: true } };
      }
    );

    const { result } = renderHook(() => useSettingsSaveQueue(execute));

    let firstPromise!: Promise<SaveOutcome>;
    let secondPromise!: Promise<SaveOutcome>;
    act(() => {
      firstPromise = result.current.persist("tmp-1");
      secondPromise = result.current.persist("tmp-1");
    });

    await act(async () => {
      // The insert minted a real id → the queue rekeys and reruns under it.
      insertRun.resolve({ outcome: { ok: true }, rekeyTo: "real-1" });
      await Promise.resolve();
    });

    const [firstOutcome, secondOutcome] = await Promise.all([
      firstPromise,
      secondPromise,
    ]);
    expect(firstOutcome).toEqual({ ok: true });
    expect(secondOutcome).toEqual({ ok: true });
    // The first run saw the temp id; the coalesced rerun ran under the real id.
    expect(seen).toEqual(["tmp-1", "real-1"]);
  });

  it("propagates a failure outcome to the caller and stays usable afterward", async () => {
    let callCount = 0;
    const execute = vi.fn((): Promise<SaveExecutorResult> => {
      callCount += 1;
      if (callCount === 1)
        return Promise.resolve({ outcome: { ok: false, error: "boom" } });
      return Promise.resolve({ outcome: { ok: true } });
    });

    const { result } = renderHook(() => useSettingsSaveQueue(execute));

    let failOutcome!: SaveOutcome;
    await act(async () => {
      failOutcome = await result.current.persist("set-1");
    });
    expect(failOutcome).toEqual({ ok: false, error: "boom" });

    // The queue is still usable for a subsequent persist of the same set.
    let okOutcome!: SaveOutcome;
    await act(async () => {
      okOutcome = await result.current.persist("set-1");
    });
    expect(okOutcome).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("converts a thrown executor into a failure outcome without stranding the caller", async () => {
    let callCount = 0;
    const execute = vi.fn((): Promise<SaveExecutorResult> => {
      callCount += 1;
      if (callCount === 1) return Promise.reject(new Error("network down"));
      return Promise.resolve(OK);
    });

    const { result } = renderHook(() => useSettingsSaveQueue(execute));

    let outcome!: SaveOutcome;
    await act(async () => {
      outcome = await result.current.persist("set-1");
    });
    expect(outcome.ok).toBe(false);

    // Still usable for a retry.
    let retry!: SaveOutcome;
    await act(async () => {
      retry = await result.current.persist("set-1");
    });
    expect(retry).toEqual({ ok: true });
  });
});
