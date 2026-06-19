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
});
