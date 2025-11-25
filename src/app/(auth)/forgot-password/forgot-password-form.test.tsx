import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";
import * as actions from "~/app/(auth)/actions";

// Mock the server action
vi.mock("~/app/(auth)/actions", () => ({
  forgotPasswordAction: vi.fn(),
}));

describe("ForgotPasswordForm", () => {
  it("should render form fields", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeDefined();
  });

  it("should disable button while submitting", async () => {
    const user = userEvent.setup();
    // Mock slow response
    vi.mocked(actions.forgotPasswordAction).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { ok: true, value: undefined };
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");

    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: /send reset link/i,
    });
    await user.click(button);

    expect(button.disabled).toBe(true);
    expect(screen.getByText(/sending/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeDefined();
    });
  });

  it("should display error message on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.forgotPasswordAction).mockResolvedValue({
      ok: false,
      code: "SERVER",
      message: "Something went wrong",
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    const button = screen.getByRole("button", { name: /send reset link/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeDefined();
    });
  });
});
