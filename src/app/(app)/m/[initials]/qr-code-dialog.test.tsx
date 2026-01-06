import { render, screen } from "@testing-library/react";
import React from "react";
import { QrCodeDialog } from "./qr-code-dialog";
import { describe, it, expect, vi } from "vitest";

// Mock Dialog to render content immediately
vi.mock("~/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/components/ui/copy-button", () => ({
  CopyButton: () => <button>Copy</button>,
}));

// Note: Using real Button component to verify asChild behavior correctly forwards aria-label
// No mock for ~/components/ui/button needed as it will use the real implementation

describe("QrCodeDialog", () => {
  it("renders the external link button with accessible label", () => {
    render(
      <QrCodeDialog
        machineName="Test Machine"
        machineInitials="TM"
        qrDataUrl="http://example.com/qr.png"
        reportUrl="http://example.com/report"
      />
    );

    const linkButton = screen.getByRole("link", {
      name: "Open report link in new tab",
    });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toHaveAttribute("href", "http://example.com/report");
  });
});
