import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

// Mock Sentry to avoid side effects in tests
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("ErrorPage", () => {
  const baseError = Object.assign(new Error("Test failure"), {
    digest: undefined as string | undefined,
  });

  it("renders 500 heading and description", () => {
    render(<ErrorPage error={baseError} reset={vi.fn()} />);

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(
        "An unexpected error occurred. Please try again or return to the home page."
      )
    ).toBeInTheDocument();
  });

  it("calls reset when Try Again is clicked", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<ErrorPage error={baseError} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders Go Home link", () => {
    render(<ErrorPage error={baseError} reset={vi.fn()} />);

    const homeLink = screen.getByRole("link", { name: /go home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("shows digest when provided", () => {
    const errorWithDigest = Object.assign(new Error("Server error"), {
      digest: "abc123",
    });

    render(<ErrorPage error={errorWithDigest} reset={vi.fn()} />);

    expect(screen.getByText("Error ID: abc123")).toBeInTheDocument();
  });

  it("does not show digest section when digest is absent", () => {
    render(<ErrorPage error={baseError} reset={vi.fn()} />);

    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });
});
