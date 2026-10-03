import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { CopyButton } from "~/components/ui/copy-button";

const writeTextMock = vi.fn().mockResolvedValue(undefined);

// Mock only the browser boundary; feedback and reset use the real component.
Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

describe("CopyButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writeTextMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies the value and restores accessible feedback after two seconds", () => {
    render(<CopyButton value="test-value" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeTextMock).toHaveBeenCalledWith("test-value");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
