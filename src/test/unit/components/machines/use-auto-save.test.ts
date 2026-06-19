import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSave } from "~/components/machines/settings/use-auto-save";

describe("useAutoSave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces schedule() to one persist after 800ms of quiet", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.schedule("a");
      result.current.schedule("a");
    });
    expect(persist).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(800));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("a");
  });

  it("flush() persists immediately and cancels the pending debounce", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.flush("a");
    });
    expect(persist).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(800));
    expect(persist).toHaveBeenCalledTimes(1); // no double-fire
  });

  it("tracks debounce timers per id independently", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.schedule("b");
      vi.advanceTimersByTime(800);
    });
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("flushAll() flushes every pending id", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.schedule("b");
      result.current.flushAll();
    });
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("cancel() drops one id without affecting the other", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.schedule("b");
      result.current.cancel("a");
      vi.advanceTimersByTime(800);
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("b");
  });

  it("CANCELS (does not persist) pending debounce timers on unmount", () => {
    // This hook owns only debounce timing; on unmount it cancels its timers.
    // Durability (persisting unsaved sets on teardown) is owned by SettingsTab's
    // save-status-driven leaving-flush, not by this hook.
    const persist = vi.fn();
    const { result, unmount } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.schedule("b");
    });
    expect(persist).not.toHaveBeenCalled();
    // Unmount cancels the timers — no persist fires from the hook itself.
    act(() => unmount());
    expect(persist).not.toHaveBeenCalled();
    // And the cancelled timers never fire afterward.
    act(() => vi.advanceTimersByTime(800));
    expect(persist).not.toHaveBeenCalled();
  });
});
