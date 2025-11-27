import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SignupForm } from "./signup-form";
import * as actions from "~/app/(auth)/actions";

// Spy on the server action
const signupActionSpy = vi.spyOn(actions, "signupAction");

// Mock useRouter
// Not needed as we rely on server action redirect
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("SignupForm", () => {
  it("should render form fields", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  it("should disable button while submitting", async () => {
    const user = userEvent.setup();
    // Mock slow response
    signupActionSpy.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { ok: true, data: { userId: "123" } };
    });

    render(<SignupForm />);

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");

    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: /create account/i,
    });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByText(/creating account/i)).toBeInTheDocument();
  });

  it("should display error message on failure", async () => {
    const user = userEvent.setup();
    signupActionSpy.mockImplementation(async () => {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Invalid input",
      };
    });

    render(<SignupForm />);

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");

    const button = screen.getByRole("button", { name: /create account/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/invalid input/i)).toBeInTheDocument();
    });
  });
});
