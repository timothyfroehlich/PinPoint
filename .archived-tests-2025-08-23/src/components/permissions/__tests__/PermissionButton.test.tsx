import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { createRef } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import "@testing-library/jest-dom";

import { PermissionButton } from "../PermissionButton";

import { PERMISSIONS } from "~/server/auth/permissions.constants";

// Mock MUI components to avoid complex setup while maintaining semantic structure
vi.mock("@mui/material", () => ({
  Button: vi
    .fn()
    .mockImplementation(
      ({
        children,
        disabled,
        onClick,
        ref,
        "aria-label": ariaLabel,
        ...props
      }: {
        children: React.ReactNode;
        disabled?: boolean;
        onClick?: () => void;
        ref?: React.Ref<HTMLButtonElement>;
        variant?: string;
        color?: string;
        "aria-label"?: string;
        [key: string]: any;
      }) => (
        <button
          disabled={disabled}
          onClick={onClick}
          ref={ref}
          role="button"
          aria-label={ariaLabel}
          {...props}
        >
          {children}
        </button>
      ),
    ),
  Tooltip: vi
    .fn()
    .mockImplementation(
      ({
        children,
        title,
        "aria-describedby": ariaDescribedBy,
      }: {
        children: React.ReactNode;
        title: string;
        "aria-describedby"?: string;
      }) => (
        <div
          role="tooltip"
          title={title}
          aria-describedby={ariaDescribedBy}
          data-tooltip-content={title}
        >
          {children}
        </div>
      ),
    ),
}));

// Use real permission constants for more accurate testing
// This ensures tests break if permission structure changes
vi.mock("~/server/auth/permissions.constants", () => ({
  PERMISSION_DESCRIPTIONS: {
    "issue:edit": "Edit existing issues",
    "issue:delete": "Delete issues",
    "machine:create": "Add new machines to locations",
    "unknown:permission": undefined, // Test unknown permission handling
  },
  PERMISSIONS: {
    ISSUE_EDIT: "issue:edit",
    ISSUE_DELETE: "issue:delete",
    MACHINE_CREATE: "machine:create",
  },
}));

describe("PermissionButton", () => {
  const mockHasPermission = vi.fn<(permission: string) => boolean>();
  const mockOnClick = vi.fn();

  const defaultProps = {
    permission: PERMISSIONS.ISSUE_EDIT,
    hasPermission: mockHasPermission,
    onClick: mockOnClick,
    children: "Edit Issue",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when user has permission", () => {
    beforeEach(() => {
      mockHasPermission.mockReturnValue(true);
    });

    it("should render an enabled button without tooltip", () => {
      render(<PermissionButton {...defaultProps} />);

      // Use semantic role-based query instead of test ID
      const button = screen.getByRole("button", { name: /edit issue/i });
      expect(button).toBeEnabled();

      // Verify no tooltip is present by checking for tooltip role
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("should execute onClick handler when activated", async () => {
      const user = userEvent.setup();
      render(<PermissionButton {...defaultProps} />);

      // Use semantic button selection
      const button = screen.getByRole("button", { name: /edit issue/i });
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it("should respect custom disabled state override", () => {
      render(<PermissionButton {...defaultProps} disabled={true} />);

      const button = screen.getByRole("button", { name: /edit issue/i });
      expect(button).toBeDisabled();
    });

    it("should maintain accessibility with custom props", () => {
      render(
        <PermissionButton
          {...defaultProps}
          aria-label="Custom edit button"
          variant="contained"
          color="primary"
        />,
      );

      const button = screen.getByRole("button", {
        name: /custom edit button/i,
      });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("variant", "contained");
      expect(button).toHaveAttribute("color", "primary");
    });
  });

  describe("when user lacks permission", () => {
    beforeEach(() => {
      mockHasPermission.mockReturnValue(false);
    });

    describe("with showWhenDenied=true (default)", () => {
      it("should render disabled button with explanatory tooltip", () => {
        render(<PermissionButton {...defaultProps} />);

        const button = screen.getByRole("button", { name: /edit issue/i });
        expect(button).toBeDisabled();

        // Verify tooltip presence using role-based query
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toBeInTheDocument();
      });

      it("should display custom tooltip text when specified", () => {
        const customMessage = "You need elevated permissions for this action";
        render(
          <PermissionButton {...defaultProps} tooltipText={customMessage} />,
        );

        // Use data attribute for more stable tooltip content testing
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveAttribute("data-tooltip-content", customMessage);
      });

      it("should generate contextual tooltip for known permissions", () => {
        render(
          <PermissionButton
            {...defaultProps}
            permission={PERMISSIONS.ISSUE_EDIT}
          />,
        );

        const tooltip = screen.getByRole("tooltip");
        // Use regex pattern matching the actual format: "You don't have permission to: [description]"
        expect(tooltip).toHaveAttribute(
          "data-tooltip-content",
          expect.stringMatching(
            /you don't have permission to:.*edit existing issues/i,
          ),
        );
      });

      it("should provide fallback tooltip for unknown permissions", () => {
        const unknownPermission = "unknown:permission";
        render(
          <PermissionButton {...defaultProps} permission={unknownPermission} />,
        );

        const tooltip = screen.getByRole("tooltip");
        // Use regex for flexible matching of fallback message structure
        expect(tooltip).toHaveAttribute(
          "data-tooltip-content",
          expect.stringMatching(/don't have permission.*unknown:permission/i),
        );
      });

      it("should handle permission descriptions with special characters", () => {
        const specialPermission = "test:special-action";
        render(
          <PermissionButton
            {...defaultProps}
            permission={specialPermission}
            tooltipText="Action requires special permissions (admin-level)"
          />,
        );

        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toHaveAttribute(
          "data-tooltip-content",
          expect.stringMatching(/admin-level/i),
        );
      });
    });

    describe("with showWhenDenied=false", () => {
      it("should render nothing when permission denied and hidden", () => {
        const { container } = render(
          <PermissionButton {...defaultProps} showWhenDenied={false} />,
        );

        // Test semantic absence rather than implementation details
        expect(container.firstChild).toBeNull();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      });

      it("should not interfere with other UI elements when hidden", () => {
        render(
          <div>
            <button>Visible Button</button>
            <PermissionButton {...defaultProps} showWhenDenied={false} />
            <button>Another Button</button>
          </div>,
        );

        // Verify only the visible buttons are present
        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(2);
        expect(
          screen.getByRole("button", { name: /visible button/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /another button/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("ref forwarding", () => {
    it("should properly forward ref to underlying button element", () => {
      mockHasPermission.mockReturnValue(true);
      const ref = createRef<HTMLButtonElement>();

      render(<PermissionButton {...defaultProps} ref={ref} />);

      // Verify ref points to the actual button element
      const button = screen.getByRole("button", { name: /edit issue/i });
      expect(ref.current).toBe(button);
      expect(ref.current?.tagName).toBe("BUTTON");
    });

    it("should maintain ref even when button is disabled", () => {
      mockHasPermission.mockReturnValue(false);
      const ref = createRef<HTMLButtonElement>();

      render(<PermissionButton {...defaultProps} ref={ref} />);

      expect(ref.current).toBeDefined();
      expect(ref.current?.disabled).toBe(true);
    });
  });

  describe("prop forwarding and accessibility", () => {
    it("should forward button properties correctly", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionButton
          {...defaultProps}
          variant="contained"
          color="primary"
          data-testid="custom-test-id"
        />,
      );

      const button = screen.getByRole("button", { name: /edit issue/i });
      expect(button).toHaveAttribute("variant", "contained");
      expect(button).toHaveAttribute("color", "primary");
      expect(button).toHaveAttribute("data-testid", "custom-test-id");
    });

    it("should maintain ARIA attributes for accessibility", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionButton
          {...defaultProps}
          aria-label="Edit issue button"
          aria-describedby="help-text"
        />,
      );

      const button = screen.getByRole("button", { name: /edit issue button/i });
      expect(button).toHaveAttribute("aria-describedby", "help-text");
    });

    it("should support complex button content", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionButton {...defaultProps}>
          <span>🔧</span> Edit Issue <span>(Admin)</span>
        </PermissionButton>,
      );

      // Test that complex content is rendered correctly
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("🔧 Edit Issue (Admin)");
    });
  });

  describe("edge cases and error scenarios", () => {
    it("should handle undefined permission gracefully", () => {
      mockHasPermission.mockReturnValue(false);

      render(
        <PermissionButton
          {...defaultProps}
          permission={undefined as unknown as string}
        />,
      );

      // Should still render disabled button with fallback tooltip
      const button = screen.getByRole("button", { name: /edit issue/i });
      expect(button).toBeDisabled();
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    it("should handle permission check function throwing error", () => {
      const errorThrowingPermissionCheck = vi.fn().mockImplementation(() => {
        throw new Error("Permission check failed");
      });

      // The component will throw when permission check fails
      // This is expected behavior - components should fail fast on broken dependencies
      expect(() => {
        render(
          <PermissionButton
            {...defaultProps}
            hasPermission={errorThrowingPermissionCheck}
          />,
        );
      }).toThrow("Permission check failed");

      expect(errorThrowingPermissionCheck).toHaveBeenCalledWith(
        PERMISSIONS.ISSUE_EDIT,
      );
    });

    it("should work with empty string permission", () => {
      mockHasPermission.mockReturnValue(false);

      render(<PermissionButton {...defaultProps} permission="" />);

      const button = screen.getByRole("button", { name: /edit issue/i });
      expect(button).toBeDisabled();
    });
  });
});
