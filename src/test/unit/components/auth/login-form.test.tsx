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

    // Check if button text changes to "Signing In..."
    expect(screen.getByRole("button")).toHaveTextContent("Signing In...");

    // Check if button is disabled
    expect(screen.getByRole("button")).toBeDisabled();

    // Check if spinner is present (Loader2 usually has 'lucide-loader-2' or similar class,
    // but we can check if the svg is there or just rely on text for now as we can't easily check for the icon component itself in this setup without deeper inspection)
    // However, the text content check + disabled check confirms the ternary branch was taken.
  });
});
