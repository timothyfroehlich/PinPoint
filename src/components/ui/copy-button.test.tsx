import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CopyButton } from "./copy-button";

describe("CopyButton", () => {
  beforeEach(() => {
    // Mock navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should have accessible label 'Copy' initially", () => {
    render(<CopyButton value="test value" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("should change accessible label to 'Copied' when clicked", () => {
    render(<CopyButton value="test value" />);

    const button = screen.getByRole("button", { name: "Copy" });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test value");
  });

  it("should revert to 'Copy' after 2 seconds", () => {
    render(<CopyButton value="test value" />);

    const button = screen.getByRole("button", { name: "Copy" });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
