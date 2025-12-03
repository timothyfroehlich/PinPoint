import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ProfileForm } from "./profile-form";
import * as actions from "./actions";

// Spy on the server action
const updateProfileSpy = vi.spyOn(actions, "updateProfileAction");

describe("ProfileForm", () => {
  const defaultProps = {
    firstName: "John",
    lastName: "Doe",
    role: "member",
  };

  it("should render form with initial profile", () => {
    render(<ProfileForm {...defaultProps} />);
    expect(screen.getByLabelText("First Name")).toHaveValue("John");
    expect(screen.getByLabelText("Last Name")).toHaveValue("Doe");
  });

  it("should call action on save", async () => {
    const user = userEvent.setup();
    updateProfileSpy.mockResolvedValue({ ok: true });

    render(<ProfileForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Update Profile" }));

    expect(updateProfileSpy).toHaveBeenCalled();
  });

  it("should reset form on cancel", async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...defaultProps} />);

    // Change input
    const firstNameInput = screen.getByLabelText("First Name");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Jane");
    expect(firstNameInput).toHaveValue("Jane");

    // Click cancel
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // Re-query because the form was re-mounted
    const resetFirstNameInput = screen.getByLabelText("First Name");

    // Verify reset
    expect(resetFirstNameInput).toHaveValue("John");
  });
});
