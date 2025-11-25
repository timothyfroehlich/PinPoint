import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    vi.mocked(actions.forgotPasswordAction).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, value: undefined }), 100)
        )
    );

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");

    const button = screen.getByRole("button", { name: /send reset link/i });
    fireEvent.submit(button.closest("form")!);

    expect(button.hasAttribute("disabled")).toBe(true);
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

    const button = screen.getByRole("button", { name: /send reset link/i });
    fireEvent.submit(button.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeDefined();
    });
  });
});
