import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { Input } from "./input";

describe("Input", () => {
  it("renders correctly", () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId("input")).toBeInTheDocument();
  });

  it("updates aria-invalid to true on blur when native validation fails", async () => {
    const user = userEvent.setup();
    render(<Input required data-testid="input" />);
    const input = screen.getByTestId("input");

    expect(input).not.toHaveAttribute("aria-invalid");

    await user.click(input);
    await user.tab();

    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("updates aria-invalid to false on blur when native validation passes", async () => {
    const user = userEvent.setup();
    render(<Input required data-testid="input" />);
    const input = screen.getByTestId("input");

    await user.type(input, "valid input");
    await user.tab();

    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("invokes caller-supplied onBlur callback", async () => {
    const user = userEvent.setup();
    const handleBlur = vi.fn();
    render(<Input onBlur={handleBlur} data-testid="input" />);
    const input = screen.getByTestId("input");

    await user.click(input);
    await user.tab();

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });
});
