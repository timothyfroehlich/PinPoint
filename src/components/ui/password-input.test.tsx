import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("renders as password type by default", () => {
    render(<PasswordInput id="pw" name="password" />);
    // Query by id to avoid ambiguity with the toggle button's aria-label
    const input = document.querySelector<HTMLInputElement>("#pw");
    expect(input).toBeInTheDocument();
    expect(input?.type).toBe("password");
  });

  it("toggle button switches to text type", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" name="password" />);

    const toggleButton = screen.getByRole("button", {
      name: /show password/i,
    });
    await user.click(toggleButton);

    const input = document.querySelector<HTMLInputElement>("#pw");
    expect(input?.type).toBe("text");
  });

  it("toggle back to password type", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" name="password" />);

    const toggleButton = screen.getByRole("button", {
      name: /show password/i,
    });
    await user.click(toggleButton);
    await user.click(toggleButton);

    const input = document.querySelector<HTMLInputElement>("#pw");
    expect(input?.type).toBe("password");
  });

  it("aria-label updates on toggle", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" name="password" />);

    const toggleButton = screen.getByRole("button", {
      name: /show password/i,
    });
    expect(toggleButton).toHaveAttribute("aria-label", "Show password");

    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-label", "Hide password");

    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-label", "Show password");
  });

  it("forwards name, id, required props", () => {
    render(<PasswordInput id="my-pw" name="my-password" required />);

    const input = document.querySelector<HTMLInputElement>("#my-pw");
    expect(input).toBeInTheDocument();
    expect(input?.name).toBe("my-password");
    expect(input?.required).toBe(true);
  });
});
