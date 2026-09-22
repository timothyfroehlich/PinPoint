// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import type { ExportIssuesResult } from "~/app/(app)/issues/export-action";
import { MachineIssuesMenu } from "./MachineIssuesMenu";

// next/link → plain anchor so hrefs are assertable.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockExport = vi.fn();
vi.mock("~/app/(app)/issues/export-action", () => ({
  exportIssuesAction: (args: unknown) => mockExport(args),
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

describe("MachineIssuesMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a ⋯ trigger button", () => {
    render(<MachineIssuesMenu machineInitials="GZ" view="open" />);
    expect(
      screen.getByRole("button", { name: /issue options/i })
    ).toBeInTheDocument();
  });

  it("opens to show the Open/All toggle, View-all link, and Export item", async () => {
    const user = userEvent.setup();
    render(<MachineIssuesMenu machineInitials="GZ" view="open" />);

    await user.click(screen.getByRole("button", { name: /issue options/i }));

    // Open/All toggle — two links pointing at the machine maintenance route.
    // Exact names: "All issues" must not collide with "Export all issues (CSV)".
    const openItem = screen.getByRole("menuitem", { name: "Open issues" });
    const allItem = screen.getByRole("menuitem", { name: "All issues" });
    expect(openItem).toHaveAttribute("href", "/m/GZ/maintenance?view=open");
    expect(allItem).toHaveAttribute("href", "/m/GZ/maintenance?view=all");

    // Open is the active view by default.
    expect(openItem).toHaveAttribute("aria-current", "true");
    expect(allItem).not.toHaveAttribute("aria-current", "true");

    // View-all link → global issues list, machine-scoped, all statuses.
    expect(
      screen.getByRole("menuitem", { name: /view all in issues list/i })
    ).toHaveAttribute("href", "/issues?machine=GZ");

    // Export item present.
    expect(
      screen.getByRole("menuitem", { name: /export all issues/i })
    ).toBeInTheDocument();
  });

  it("marks the All view active when view='all'", async () => {
    const user = userEvent.setup();
    render(<MachineIssuesMenu machineInitials="GZ" view="all" />);

    await user.click(screen.getByRole("button", { name: /issue options/i }));

    expect(
      screen.getByRole("menuitem", { name: "All issues" })
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("menuitem", { name: "Open issues" })
    ).not.toHaveAttribute("aria-current", "true");
  });

  it("calls the export action scoped to the machine on Export", async () => {
    mockExport.mockResolvedValue({
      ok: true,
      value: { csv: "a,b\n1,2", fileName: "GZ-issues.csv" },
    });
    const user = userEvent.setup();
    render(<MachineIssuesMenu machineInitials="GZ" view="open" />);

    await user.click(screen.getByRole("button", { name: /issue options/i }));
    await user.click(
      screen.getByRole("menuitem", { name: /export all issues/i })
    );

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith({ machineInitials: "GZ" });
    });
  });

  it("prevents multiple concurrent exports", async () => {
    let resolveExport: ((value: ExportIssuesResult) => void) | undefined;
    const exportPromise = new Promise<ExportIssuesResult>((resolve) => {
      resolveExport = resolve;
    });
    mockExport.mockReturnValue(exportPromise);

    const user = userEvent.setup();
    render(<MachineIssuesMenu machineInitials="GZ" view="open" />);

    await user.click(screen.getByRole("button", { name: /issue options/i }));
    const exportItem = screen.getByRole("menuitem", {
      name: /export all issues/i,
    });
    await user.click(exportItem);

    // Radix dropdown items don't natively use the `disabled` DOM attribute for a variety of reasons,
    // they use aria-disabled or pointer-events-none.
    await user.click(screen.getByRole("button", { name: /issue options/i }));
    const pendingExportItem = screen.getByRole("menuitem", {
      name: "Exporting issues…",
    });
    expect(pendingExportItem).toHaveAttribute("aria-disabled", "true");

    // Exercise the disabled item directly to guard against a future regression
    // that visually disables the item but still lets its selection handler run.
    fireEvent.click(pendingExportItem);
    expect(mockExport).toHaveBeenCalledTimes(1);

    if (resolveExport === undefined) {
      throw new Error("Expected the export action promise to have a resolver");
    }
    resolveExport({
      ok: true,
      value: { csv: "a,b\n1,2", fileName: "GZ-issues.csv" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("menuitem", { name: /export all issues/i })
      ).not.toHaveAttribute("aria-disabled");
    });
  });

  it("reports when the browser cannot create a CSV download", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: undefined,
    });
    mockExport.mockResolvedValue({
      ok: true,
      value: { csv: "a,b\n1,2", fileName: "GZ-issues.csv" },
    });

    try {
      const user = userEvent.setup();
      render(<MachineIssuesMenu machineInitials="GZ" view="open" />);

      await user.click(screen.getByRole("button", { name: /issue options/i }));
      await user.click(
        screen.getByRole("menuitem", { name: /export all issues/i })
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Download failed. Your browser may not support file downloads."
        );
      });
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
    }
  });
});
