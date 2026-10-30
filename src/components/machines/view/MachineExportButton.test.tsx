/**
 * RTL Unit Tests: MachineExportButton
 *
 * Covers the button's UI states (disabled while exporting, re-enabled after a
 * success or an EMPTY response) and what it sends: the list's URL query and
 * the Surface scope, never a machine list. The CSV itself is the action's
 * integration test.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MachineExportButton } from "./MachineExportButton";

// Mock sonner toast to avoid jsdom issues
vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const mockExportAction = vi.fn();

vi.mock("~/app/(app)/m/export-action", () => ({
  exportMachinesAction: (...args: unknown[]) => mockExportAction(...args),
}));

describe("MachineExportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the list's query and the Surface scope", async () => {
    mockExportAction.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(
      <MachineExportButton
        query="sort=year&dir=desc"
        scope={{ kind: "tag", type: "manufacturer", slug: "stern" }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Export to CSV" }));

    expect(mockExportAction).toHaveBeenCalledWith({
      query: "sort=year&dir=desc",
      scope: { kind: "tag", type: "manufacturer", slug: "stern" },
    });
  });

  it("disables the button while export is in progress", async () => {
    // Action never resolves so the button stays disabled throughout the test
    mockExportAction.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<MachineExportButton query="" scope={{ kind: "all" }} />);

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
    render(<MachineExportButton query="" scope={{ kind: "all" }} />);

    const btn = screen.getByRole("button", { name: "Export to CSV" });
    await user.click(btn);

    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  it("re-enables the button after a failed export (EMPTY response)", async () => {
    mockExportAction.mockResolvedValue({
      ok: false,
      code: "EMPTY",
      message: "No machines match the current filters.",
    });

    const user = userEvent.setup();
    render(<MachineExportButton query="" scope={{ kind: "all" }} />);

    const btn = screen.getByRole("button", { name: "Export to CSV" });
    await user.click(btn);

    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });
});
