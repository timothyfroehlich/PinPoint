/**
 * ConfirmingDeleteButton — per-row delete affordance redesign (PP-43q3 bug #4a).
 *
 * Key invariants tested here:
 *   (a) Desktop (useIsMobile → false): first click arms, button label becomes
 *       "Tap again to delete"; second click fires onConfirmedDelete.
 *   (b) Mobile (useIsMobile → true): click opens an AlertDialog; confirming
 *       calls onConfirmedDelete; Cancel does not.
 *   (c) Both branches: e.stopPropagation() prevents bubbling to a parent
 *       click handler (e.g. the row's sheet-open handler).
 */
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ConfirmingDeleteButton } from "~/components/machines/settings/ConfirmingDeleteButton";

// Mock useIsMobile so we can drive both branches without a real media query.
vi.mock("~/hooks/use-is-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

import { useIsMobile } from "~/hooks/use-is-mobile";

const mockUseIsMobile = vi.mocked(useIsMobile);

describe("ConfirmingDeleteButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseIsMobile.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Desktop (useIsMobile → false)", () => {
    it("renders with the given ariaLabel in the disarmed state", () => {
      render(
        <ConfirmingDeleteButton
          ariaLabel="Delete switch S31"
          onConfirmedDelete={vi.fn()}
        />
      );
      expect(
        screen.getByRole("button", { name: "Delete switch S31" })
      ).toBeInTheDocument();
    });

    it("first click arms: accessible name flips to 'Tap again to delete'", () => {
      render(
        <ConfirmingDeleteButton
          ariaLabel="Delete switch S31"
          onConfirmedDelete={vi.fn()}
        />
      );
      const btn = screen.getByRole("button", { name: "Delete switch S31" });
      fireEvent.click(btn);
      // After arming, the accessible name includes the confirm copy.
      expect(
        screen.getByRole("button", { name: /tap again to delete/i })
      ).toBeInTheDocument();
    });

    it("second click calls onConfirmedDelete", () => {
      const onConfirmedDelete = vi.fn();
      render(
        <ConfirmingDeleteButton
          ariaLabel="Delete switch S31"
          onConfirmedDelete={onConfirmedDelete}
        />
      );
      const btn = screen.getByRole("button", { name: "Delete switch S31" });
      fireEvent.click(btn); // arm
      const armed = screen.getByRole("button", {
        name: /tap again to delete/i,
      });
      fireEvent.click(armed); // confirm
      expect(onConfirmedDelete).toHaveBeenCalledTimes(1);
    });

    it("disarms automatically after 3 s without a second click", () => {
      render(
        <ConfirmingDeleteButton
          ariaLabel="Delete switch S31"
          onConfirmedDelete={vi.fn()}
        />
      );
      const btn = screen.getByRole("button", { name: "Delete switch S31" });
      fireEvent.click(btn); // arm
      expect(
        screen.getByRole("button", { name: /tap again to delete/i })
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3100);
      });

      // Back to the original label — disarmed.
      expect(
        screen.getByRole("button", { name: "Delete switch S31" })
      ).toBeInTheDocument();
    });

    it("stopPropagation: parent click handler is NOT called when arming", () => {
      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <ConfirmingDeleteButton
            ariaLabel="Delete switch S31"
            onConfirmedDelete={vi.fn()}
          />
        </div>
      );
      const btn = screen.getByRole("button", { name: "Delete switch S31" });
      fireEvent.click(btn);
      expect(parentClick).not.toHaveBeenCalled();
    });

    it("stopPropagation: parent click handler is NOT called on confirm", () => {
      const parentClick = vi.fn();
      const onConfirmedDelete = vi.fn();
      render(
        <div onClick={parentClick}>
          <ConfirmingDeleteButton
            ariaLabel="Delete switch S31"
            onConfirmedDelete={onConfirmedDelete}
          />
        </div>
      );
      const btn = screen.getByRole("button", { name: "Delete switch S31" });
      fireEvent.click(btn); // arm
      const armed = screen.getByRole("button", {
        name: /tap again to delete/i,
      });
      fireEvent.click(armed); // confirm
      expect(parentClick).not.toHaveBeenCalled();
      expect(onConfirmedDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Mobile (useIsMobile → true)", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders a trash trigger button", () => {
      render(
        <ConfirmingDeleteButton
          ariaLabel="Delete switch S31"
          onConfirmedDelete={vi.fn()}
        />
      );
      expect(
        screen.getByRole("button", { name: "Delete switch S31" })
      ).toBeInTheDocument();
    });

    it("clicking the trigger opens a confirm dialog with Delete and Cancel", () => {
      render(
        <ConfirmingDeleteButton
          ariaLabel="Delete switch S31"
          onConfirmedDelete={vi.fn()}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Delete switch S31" })
      );
      // AlertDialog renders with role=alertdialog
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("clicking Delete in the dialog calls onConfirmedDelete", () => {
      const onConfirmedDelete = vi.fn();
      render(
        <ConfirmingDeleteButton
          ariaLabel="Delete switch S31"
          onConfirmedDelete={onConfirmedDelete}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Delete switch S31" })
      );
      // Scope the Delete button query to the dialog so a missing button fails
      // with a clear message rather than a runtime TypeError on `!`.
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));
      expect(onConfirmedDelete).toHaveBeenCalledTimes(1);
    });

    it("clicking Cancel does NOT call onConfirmedDelete", () => {
      const onConfirmedDelete = vi.fn();
      render(
        <ConfirmingDeleteButton
          ariaLabel="Delete switch S31"
          onConfirmedDelete={onConfirmedDelete}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Delete switch S31" })
      );
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onConfirmedDelete).not.toHaveBeenCalled();
    });

    it("stopPropagation: parent click handler is NOT called when opening dialog", () => {
      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <ConfirmingDeleteButton
            ariaLabel="Delete switch S31"
            onConfirmedDelete={vi.fn()}
          />
        </div>
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Delete switch S31" })
      );
      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
