import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders correctly", () => {
    render(<Textarea data-testid="textarea" />);
    expect(screen.getByTestId("textarea")).toBeInTheDocument();
  });

  it("updates aria-invalid to true on blur when native validation fails", async () => {
    const user = userEvent.setup();
    render(<Textarea required data-testid="textarea" />);
    const textarea = screen.getByTestId("textarea");

    expect(textarea).not.toHaveAttribute("aria-invalid");

    await user.click(textarea);
    await user.tab();

    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });

  it("updates aria-invalid to false on blur when native validation passes", async () => {
    const user = userEvent.setup();
    render(<Textarea required data-testid="textarea" />);
    const textarea = screen.getByTestId("textarea");

    await user.type(textarea, "valid content");
    await user.tab();

    expect(textarea).toHaveAttribute("aria-invalid", "false");
  });

  it("invokes caller-supplied onBlur callback", async () => {
    const user = userEvent.setup();
    const handleBlur = vi.fn();
    render(<Textarea onBlur={handleBlur} data-testid="textarea" />);
    const textarea = screen.getByTestId("textarea");

    await user.click(textarea);
    await user.tab();

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });
});
