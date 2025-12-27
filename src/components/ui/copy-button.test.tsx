import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CopyButton } from "./copy-button";

describe("CopyButton", () => {
  const writeTextMock = vi.fn();

  beforeEach(() => {
    // Mock navigator.clipboard.writeText using Object.defineProperty
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should render copy button", () => {
    render(<CopyButton value="test value" />);
    // Check for the icon button, looking for the sr-only text
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("should copy text to clipboard when clicked", () => {
    render(<CopyButton value="test value" />);

    fireEvent.click(screen.getByRole("button"));

    expect(writeTextMock).toHaveBeenCalledWith("test value");
  });

  it("should change text to 'Copied' temporarily", () => {
    vi.useFakeTimers();
    render(<CopyButton value="test value" />);

    fireEvent.click(screen.getByRole("button"));

    // Expect the text to change to "Copied"
    expect(screen.getByText("Copied")).toBeInTheDocument();
    expect(screen.queryByText("Copy")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should revert back
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });
});
