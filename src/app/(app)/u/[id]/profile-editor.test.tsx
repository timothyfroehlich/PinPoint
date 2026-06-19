import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("~/app/(app)/u/[id]/actions", () => ({ updateProfileAction: vi.fn() }));
vi.mock("~/server/actions/avatar", () => ({
  uploadAvatarAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
    render(<ProfileEditor profileId="u1" initial={initial} />);
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Pat");
    expect(screen.getByLabelText(/pronouns/i)).toHaveValue("they/them");
    expect(screen.getByLabelText(/bio/i)).toHaveValue("EM games");
  });

  it("exposes a file input for the avatar", () => {
    render(<ProfileEditor profileId="u1" initial={initial} />);
    const fileInput = screen.getByLabelText(/profile photo/i);
    expect(fileInput).toHaveAttribute("type", "file");
  });

  it("offers a Cancel control that links back to the read view", () => {
    render(<ProfileEditor profileId="u1" initial={initial} />);
    expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute(
      "href",
      "/u/u1"
    );
  });
});
