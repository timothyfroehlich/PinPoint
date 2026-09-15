import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { SentryInitializer } from "~/components/SentryInitializer";

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  isInitialized: vi.fn(),
  feedbackIntegration: vi.fn(() => ({})),
}));

describe("SentryInitializer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Sentry.init when Sentry is not yet initialized", () => {
    vi.mocked(Sentry.isInitialized).mockReturnValue(false);

    render(<SentryInitializer />);

    expect(Sentry.isInitialized).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });

  it("does not call Sentry.init when Sentry is already initialized", () => {
    vi.mocked(Sentry.isInitialized).mockReturnValue(true);

    render(<SentryInitializer />);

    expect(Sentry.isInitialized).toHaveBeenCalledTimes(1);
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
