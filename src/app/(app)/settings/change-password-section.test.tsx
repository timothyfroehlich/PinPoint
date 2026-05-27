import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChangePasswordSection } from "./change-password-section";
import * as actions from "./actions";

// Mock useActionState to control state across renders
const mockUseActionState = vi.fn();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: (fn: unknown, initialState: unknown) =>
      mockUseActionState(fn, initialState),
  };
});

// Spy on the server action to prevent module-level execution
const changePasswordSpy = vi.spyOn(actions, "changePasswordAction");

describe("ChangePasswordSection", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([undefined, vi.fn(), false]);
  });

  it("renders all three password fields", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByLabelText(/^Current Password\b/i)).toBeVisible();
    expect(screen.getByLabelText(/^New Password\b/i)).toBeVisible();
    expect(screen.getByLabelText(/^Confirm New Password\b/i)).toBeVisible();
  });

  it("renders the Change Password button", () => {
    render(<ChangePasswordSection />);
    expect(
      screen.getByRole("button", { name: "Change Password" })
    ).toBeVisible();
  });

  it("has correct autocomplete attributes", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByLabelText(/^Current Password\b/i)).toHaveAttribute(
      "autocomplete",
      "current-password"
    );
    expect(screen.getByLabelText(/^New Password\b/i)).toHaveAttribute(
      "autocomplete",
      "new-password"
    );
  });

  it("renders the error message when the current password is wrong", () => {
    mockUseActionState.mockReturnValue([
      {
        ok: false,
        error: "WRONG_PASSWORD" as const,
        message: "Current password is incorrect.",
      },
      vi.fn(),
      false,
    ]);

    render(<ChangePasswordSection />);

    expect(screen.getByText("Current password is incorrect.")).toBeVisible();
  });
});
