import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CopyButton } from "./copy-button";
import * as React from "react";

describe("CopyButton", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it("changes sr-only text after clicking", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<CopyButton value="test-value" />);

    // Initial state
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();

    // Click button
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockWriteText).toHaveBeenCalledWith("test-value");

    // Expect "Copied" to be in the document (SR feedback)
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    // "Copy" should be gone
    expect(screen.queryByText("Copy")).not.toBeInTheDocument();
  });
});
