import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("~/app/(app)/u/[id]/actions", () => ({ updateProfileAction: vi.fn() }));
vi.mock("~/server/actions/avatar", () => ({
  uploadAvatarAction: vi.fn(),
  uploadAvatarFormAction: vi.fn(),
}));

import { ProfileEditor } from "./profile-editor";

const initial = {
  firstName: "Pat",
  lastName: "Quinn",
  pronouns: "they/them",
  bio: "EM games",
  avatarUrl: null,
};

describe("ProfileEditor", () => {
  it("pre-fills the form fields from initial values", () => {
    render(<ProfileEditor initial={initial} />);
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Pat");
    expect(screen.getByLabelText(/pronouns/i)).toHaveValue("they/them");
    expect(screen.getByLabelText(/bio/i)).toHaveValue("EM games");
  });

  it("exposes a file input for the avatar", () => {
    render(<ProfileEditor initial={initial} />);
    expect(screen.getByLabelText(/avatar/i)).toBeInTheDocument();
  });
});
