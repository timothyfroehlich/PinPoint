import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LoginForm } from "~/app/(auth)/login/login-form";
import React from "react";

// Mock useActionState
const mockUseActionState = vi.fn();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: (...args: any[]) => mockUseActionState(...args),
  };
});

describe("LoginForm", () => {
  beforeEach(() => {
    mockUseActionState.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders correctly", () => {
    // Default mock implementation: [state, action, isPending]
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);

    render(<LoginForm />);

    // Check for the button text.
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDefined();
    // It should not show "Signing In..."
    expect(screen.queryByText("Signing In...")).toBeNull();
    // Button should be enabled
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  it("shows loading state when pending", () => {
    // Mock pending state: [state, action, isPending=true]
    mockUseActionState.mockReturnValue([null, vi.fn(), true]);

    render(<LoginForm />);

    // Check if submit button is disabled
    const button = screen.getByRole("button", { name: /sign in/i });
    expect(button).toBeDisabled();

    // With standardized Button component, text remains "Sign In" but a spinner is added.
    expect(button).toHaveTextContent("Sign In");

    // Check for the spinner SVG which has the animate-spin class
    const spinner = button.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});
