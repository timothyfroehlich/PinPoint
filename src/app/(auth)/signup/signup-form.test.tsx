import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SignupForm } from "./signup-form";
import * as actions from "~/app/(auth)/actions";

// Mock the server action
vi.mock("~/app/(auth)/actions", () => ({
  signupAction: vi.fn(),
}));

// Mock useRouter
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("SignupForm", () => {
  it("should render form fields", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/name/i)).toBeDefined();
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeDefined();
  });

  it("should disable button while submitting", async () => {
    const user = userEvent.setup();
    // Mock slow response
    vi.mocked(actions.signupAction).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, value: { userId: "123" } }), 100)
        )
    );

    render(<SignupForm />);

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");

    const button = screen.getByRole("button", { name: /create account/i });
    fireEvent.submit(button.closest("form")!);

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/creating account/i)).toBeDefined();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("should display error message on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.signupAction).mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
    });

    render(<SignupForm />);

    const button = screen.getByRole("button", { name: /create account/i });
    fireEvent.submit(button.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/invalid input/i)).toBeDefined();
    });
  });
});
