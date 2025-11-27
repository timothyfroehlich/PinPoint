import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";
import * as actions from "~/app/(auth)/actions";

// Spy on the server action
const forgotPasswordActionSpy = vi.spyOn(actions, "forgotPasswordAction");

describe("ForgotPasswordForm", () => {
  it("should render form fields", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it("should disable button while submitting", async () => {
    const user = userEvent.setup();
    // Mock slow response
    forgotPasswordActionSpy.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { ok: true, data: undefined };
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");

    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: /send reset link/i,
    });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByText(/sending/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    });
  });

  it("should display error message on failure", async () => {
    const user = userEvent.setup();
    forgotPasswordActionSpy.mockResolvedValue({
      ok: false,
      code: "SERVER",
      message: "Something went wrong",
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    const button = screen.getByRole("button", { name: /send reset link/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
