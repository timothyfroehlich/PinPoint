import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTurnstileGate } from "./useTurnstileGate";

// Mock Sentry so the client fail-open breadcrumb doesn't need a transport.
vi.mock("@sentry/nextjs", () => ({ addBreadcrumb: vi.fn() }));

describe("useTurnstileGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Force captcha enforcement on: requires a site key AND a non-test NODE_ENV.
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("does not gate submit when captcha is not enforced (no site key)", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    const { result } = renderHook(() => useTurnstileGate());

    expect(result.current.submitDisabled).toBe(false);
    expect(result.current.statusMessage).toBeNull();
  });

  it("gates submit while waiting, then enables when a token arrives (resilience)", () => {
    const { result } = renderHook(() => useTurnstileGate());

    expect(result.current.submitDisabled).toBe(true);
    expect(result.current.statusMessage).toBe("Verifying you're human…");

    act(() => {
      result.current.onVerify("tok-123");
    });

    expect(result.current.token).toBe("tok-123");
    expect(result.current.submitDisabled).toBe(false);
    expect(result.current.statusMessage).toBeNull();
  });

  it("FAILS OPEN: enables submit after the resilience window even with no token", () => {
    const { result } = renderHook(() => useTurnstileGate());
    expect(result.current.submitDisabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    // The dead-button bug: submit must never stay disabled forever.
    expect(result.current.token).toBe("");
    expect(result.current.submitDisabled).toBe(false);
  });

  it("dead button never happens: an error keeps a good token and never re-disables", () => {
    const { result } = renderHook(() => useTurnstileGate());

    act(() => {
      result.current.onVerify("tok-123");
    });
    expect(result.current.submitDisabled).toBe(false);

    // The original bug wired onError -> clear token, re-disabling submit.
    act(() => {
      result.current.onError();
    });
    expect(result.current.token).toBe("tok-123");
    expect(result.current.submitDisabled).toBe(false);
  });

  it("after a successful verify, a later expiry does not re-disable the button (one-way latch)", () => {
    const { result } = renderHook(() => useTurnstileGate());

    act(() => {
      result.current.onVerify("tok-123");
    });
    expect(result.current.submitDisabled).toBe(false);

    // Token expires minutes later: the freshest value is cleared, but the gate
    // stays open so submit is never re-disabled (the bug Copilot flagged).
    act(() => {
      result.current.onExpire();
    });
    expect(result.current.token).toBe("");
    expect(result.current.submitDisabled).toBe(false);
    expect(result.current.statusMessage).toBeNull();
  });

  it("once failed open, a later expiry does not re-disable the button (one-way latch)", () => {
    const { result } = renderHook(() => useTurnstileGate());

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(result.current.submitDisabled).toBe(false);

    act(() => {
      result.current.onExpire();
    });
    expect(result.current.token).toBe("");
    expect(result.current.submitDisabled).toBe(false);
  });
});
