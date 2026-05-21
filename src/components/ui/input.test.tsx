import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  describe("aria-invalid blur sync", () => {
    it("sets aria-invalid=true on blur when value violates required constraint", async () => {
      const user = userEvent.setup();
      render(<Input data-testid="inp" required />);
      const input = screen.getByTestId("inp");

      await user.click(input);
      await user.tab();

      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("sets aria-invalid=false on blur when value satisfies required constraint", async () => {
      const user = userEvent.setup();
      render(<Input data-testid="inp" required />);
      const input = screen.getByTestId("inp");

      await user.click(input);
      await user.type(input, "hello");
      await user.tab();

      expect(input).toHaveAttribute("aria-invalid", "false");
    });

    it("sets aria-invalid=true on blur when email format is invalid", async () => {
      const user = userEvent.setup();
      render(<Input data-testid="inp" type="email" />);
      const input = screen.getByTestId("inp");

      await user.click(input);
      await user.type(input, "not-an-email");
      await user.tab();

      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("sets aria-invalid=false on blur when email format is valid", async () => {
      const user = userEvent.setup();
      render(<Input data-testid="inp" type="email" />);
      const input = screen.getByTestId("inp");

      await user.click(input);
      await user.type(input, "user@example.com");
      await user.tab();

      expect(input).toHaveAttribute("aria-invalid", "false");
    });

    it("calls caller-provided onBlur in addition to syncing aria-invalid", async () => {
      const user = userEvent.setup();
      const onBlur = vi.fn();
      render(<Input data-testid="inp" onBlur={onBlur} />);
      const input = screen.getByTestId("inp");

      await user.click(input);
      await user.tab();

      expect(onBlur).toHaveBeenCalledOnce();
    });
  });
});
