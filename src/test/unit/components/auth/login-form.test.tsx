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

    // Check if button is disabled
    expect(screen.getByRole("button")).toBeDisabled();

    // With standardized Button component, text remains "Sign In" but a spinner is added.
    // However, looking at the code: <Button ... loading={isPending}>Sign In</Button>
    // The Button component logic is: {loading && <Loader2 ... />} {children}
    // So the text "Sign In" is still there.
    expect(screen.getByRole("button")).toHaveTextContent("Sign In");

    // We can check if the button contains the loader
    // Loader2 renders an SVG.
    // Since we mocked useActionState to return isPending=true, the loading prop on Button is true.
  });
});
