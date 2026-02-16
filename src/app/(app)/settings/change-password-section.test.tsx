import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChangePasswordSection } from "./change-password-section";
import * as actions from "./actions";

// Spy on the server action to prevent module-level execution
const changePasswordSpy = vi.spyOn(actions, "changePasswordAction");

describe("ChangePasswordSection", () => {
  it("renders all three password fields", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByLabelText("Current Password")).toBeVisible();
    expect(screen.getByLabelText("New Password")).toBeVisible();
    expect(screen.getByLabelText("Confirm New Password")).toBeVisible();
  });

  it("renders the Change Password button", () => {
    render(<ChangePasswordSection />);
    expect(
      screen.getByRole("button", { name: "Change Password" })
    ).toBeVisible();
  });

  it("has correct autocomplete attributes", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByLabelText("Current Password")).toHaveAttribute(
      "autocomplete",
      "current-password"
    );
    expect(screen.getByLabelText("New Password")).toHaveAttribute(
      "autocomplete",
      "new-password"
    );
  });
});
