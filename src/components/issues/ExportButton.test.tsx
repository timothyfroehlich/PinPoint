/**
 * RTL Unit Tests: ExportButton
 *
 * Covers H-class UI state (button disabled during export, loading indicator)
 * downgraded from e2e/smoke/machine-details-redesign.spec.ts (Wave 3a, Row 27).
 * The full export journey (CSV download trigger) is kept as class-F E2E in
 * that same smoke spec ("should export machine issues to CSV").
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExportButton } from "./ExportButton";

// Mock sonner toast to avoid jsdom issues
vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Tooltip components (Radix UI) to render children directly
vi.mock("~/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (asChild ? <>{children}</> : <div>{children}</div>),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockExportAction = vi.fn();

vi.mock("~/app/(app)/issues/export-action", () => ({
  exportIssuesAction: (...args: unknown[]) => mockExportAction(...args),
}));

describe("ExportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an accessible export button", () => {
    render(<ExportButton machineInitials="TM" />);
    const btn = screen.getByRole("button", { name: "Export to CSV" });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("disables the button while export is in progress", async () => {
    // Action never resolves so the button stays disabled throughout the test
    mockExportAction.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<ExportButton machineInitials="TM" />);

    const btn = screen.getByRole("button", { name: "Export to CSV" });
    await user.click(btn);

    await waitFor(() => {
      expect(btn).toBeDisabled();
    });
  });

  it("re-enables the button after a successful export", async () => {
    mockExportAction.mockResolvedValue({
      ok: true,
      value: { csv: "col1,col2\nval1,val2", fileName: "export.csv" },
    });

    // Stub out Blob / URL APIs in jsdom
    const createObjectURL = vi.fn(() => "blob:http://localhost/fake");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    // Stub link.click so jsdom doesn't throw
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === "a") {
        el.click = clickSpy;
      }
      return el;
    });

    const user = userEvent.setup();
    render(<ExportButton machineInitials="TM" />);

    const btn = screen.getByRole("button", { name: "Export to CSV" });
    await user.click(btn);

    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });

    vi.restoreAllMocks();
  });

  it("re-enables the button after a failed export (EMPTY response)", async () => {
    mockExportAction.mockResolvedValue({
      ok: false,
      code: "EMPTY",
      message: "No issues to export.",
    });

    const user = userEvent.setup();
    render(<ExportButton machineInitials="TM" />);

    const btn = screen.getByRole("button", { name: "Export to CSV" });
    await user.click(btn);

    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });
});
