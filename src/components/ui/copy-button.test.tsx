import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { CopyButton } from "./copy-button";

// Mock navigator.clipboard
const writeTextMock = vi.fn().mockImplementation(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: writeTextMock,
  },
});

describe("CopyButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writeTextMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with 'Copy' accessible text", () => {
    render(<CopyButton value="test-value" />);
    // Initial state
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("copies value and changes text to 'Copied'", () => {
    render(<CopyButton value="test-value" />);

    const button = screen.getByRole("button", { name: /copy/i });

    fireEvent.click(button);

    expect(writeTextMock).toHaveBeenCalledWith("test-value");

    // Check if text changed to "Copied"
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("reverts to 'Copy' after timeout", () => {
    render(<CopyButton value="test-value" />);

    const button = screen.getByRole("button", { name: /copy/i });

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();

    // Advance time
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  // Note: Tooltip visibility tests are omitted as they are unreliable in JSDOM
  // due to reliance on layout measurements (ResizeObserver, etc.) and PointerEvents.
  // Visual verification was performed via E2E script.
});
