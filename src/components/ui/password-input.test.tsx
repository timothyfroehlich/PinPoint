import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { PasswordInput } from "~/components/ui/password-input";

describe("PasswordInput", () => {
  it("toggles password visibility and its accessible label in both directions", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" name="password" />);
    const input = document.querySelector<HTMLInputElement>("#pw");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Show password" })
    ).toBeInTheDocument();
  });

  it("forwards name, id, required props", () => {
    render(<PasswordInput id="my-pw" name="my-password" required />);

    const input = document.querySelector<HTMLInputElement>("#my-pw");
    expect(input).toBeInTheDocument();
    expect(input?.name).toBe("my-password");
    expect(input?.required).toBe(true);
  });
});
