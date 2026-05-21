import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  describe("aria-invalid blur sync", () => {
    it("sets aria-invalid=true on blur when value violates required constraint", async () => {
      const user = userEvent.setup();
      render(<Textarea data-testid="ta" required />);
      const textarea = screen.getByTestId("ta");

      await user.click(textarea);
      await user.tab();

      expect(textarea).toHaveAttribute("aria-invalid", "true");
    });

    it("sets aria-invalid=false on blur when value satisfies required constraint", async () => {
      const user = userEvent.setup();
      render(<Textarea data-testid="ta" required />);
      const textarea = screen.getByTestId("ta");

      await user.click(textarea);
      await user.type(textarea, "some content");
      await user.tab();

      expect(textarea).toHaveAttribute("aria-invalid", "false");
    });

    it("calls caller-provided onBlur in addition to syncing aria-invalid", async () => {
      const user = userEvent.setup();
      const onBlur = vi.fn();
      render(<Textarea data-testid="ta" onBlur={onBlur} />);
      const textarea = screen.getByTestId("ta");

      await user.click(textarea);
      await user.tab();

      expect(onBlur).toHaveBeenCalledOnce();
    });
  });
});
