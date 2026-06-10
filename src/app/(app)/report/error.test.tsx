/**
 * RTL tests for the report segment error boundary (PP-2053.6).
 *
 * Verifies:
 *  - The draft-kept message is shown
 *  - "Try Again" triggers reset
 *  - "Back to Report Form" links to /report
 *  - Error digest is shown when present
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ReportErrorPage from "./error";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("ReportErrorPage (report segment error boundary)", () => {
  const baseError = Object.assign(new Error("504 Gateway Timeout"), {
    digest: undefined as string | undefined,
  });

  it("renders the draft-kept heading and message", () => {
    render(<ReportErrorPage error={baseError} reset={vi.fn()} />);

    expect(
      screen.getByText("Your report could not be saved")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your draft has been kept. Please try again.")
    ).toBeInTheDocument();
  });

  it("calls reset when Try Again is clicked", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<ReportErrorPage error={baseError} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders a Back to Report Form link pointing to /report", () => {
    render(<ReportErrorPage error={baseError} reset={vi.fn()} />);

    const link = screen.getByRole("link", { name: /back to report form/i });
    expect(link).toHaveAttribute("href", "/report");
  });

  it("shows Error ID when digest is provided", () => {
    const errorWithDigest = Object.assign(new Error("Server error"), {
      digest: "abc123",
    });

    render(<ReportErrorPage error={errorWithDigest} reset={vi.fn()} />);

    expect(screen.getByText("Error ID: abc123")).toBeInTheDocument();
  });

  it("does not show Error ID when digest is absent", () => {
    render(<ReportErrorPage error={baseError} reset={vi.fn()} />);

    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });
});
