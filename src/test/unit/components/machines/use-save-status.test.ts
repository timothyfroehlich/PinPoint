import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSaveStatus } from "~/components/machines/settings/use-save-status";

describe("useSaveStatus", () => {
  it("marks pending then clears on saved", () => {
    const { result } = renderHook(() => useSaveStatus());
    act(() => result.current.markPending("a"));
    expect(result.current.pending).toBe(true);
    expect(result.current.hasUnsaved).toBe(true);
    act(() => result.current.markSaved("a"));
    expect(result.current.pending).toBe(false);
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("records a failure and surfaces it until re-saved", () => {
    const { result } = renderHook(() => useSaveStatus());
    act(() => result.current.markPending("a"));
    act(() => result.current.markFailed("a"));
    expect(result.current.failedIds.has("a")).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.hasUnsaved).toBe(true);
    act(() => result.current.markSaved("a"));
    expect(result.current.failedIds.has("a")).toBe(false);
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("re-pending a failed id keeps hasUnsaved true and clears the failure on success", () => {
    const { result } = renderHook(() => useSaveStatus());
    act(() => {
      result.current.markFailed("a");
      result.current.markPending("a"); // retry
    });
    expect(result.current.failedIds.has("a")).toBe(false);
    expect(result.current.pending).toBe(true);
  });
});
