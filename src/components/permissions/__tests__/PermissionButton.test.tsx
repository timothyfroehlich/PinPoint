import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { createRef } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import "@testing-library/jest-dom/vitest";

import { PermissionButton } from "../PermissionButton";

// Mock MUI components to avoid complex setup
vi.mock("@mui/material", () => ({
  Button: vi.fn<
    React.JSX.Element,
    [
      {
        children: React.ReactNode;
        disabled?: boolean;
        onClick?: () => void;
        ref?: React.Ref<HTMLButtonElement>;
        variant?: string;
        color?: string;
      },
    ]
  >(({ children, disabled, onClick, ref, ...props }) => (
    <button
      disabled={disabled}
      onClick={onClick}
      data-testid="permission-button"
      ref={ref}
      {...props}
    >
      {children}
    </button>
  )),
  Tooltip: vi.fn<
    React.JSX.Element,
    [{ children: React.ReactNode; title: string }]
  >(({ children, title }) => (
    <div data-testid="tooltip" title={title}>
      {children}
    </div>
  )),
}));

// Mock permission constants
vi.mock("~/server/auth/permissions.constants", () => ({
  PERMISSION_DESCRIPTIONS: {
    "issue:edit": "Edit existing issues",
    "issue:delete": "Delete issues",
  },
}));

describe("PermissionButton", () => {
  const mockHasPermission = vi.fn<[string], boolean>();
  const mockOnClick = vi.fn();

  const defaultProps = {
    permission: "issue:edit",
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

    it("should render an enabled button", () => {
      render(<PermissionButton {...defaultProps} />);

      const button = screen.getByTestId("permission-button");
      expect(button).not.toBeDisabled();
      expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
    });

    it("should call onClick when clicked", async () => {
      const user = userEvent.setup();
      render(<PermissionButton {...defaultProps} />);

      const button = screen.getByTestId("permission-button");
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it("should respect custom disabled prop", () => {
      render(<PermissionButton {...defaultProps} disabled={true} />);

      const button = screen.getByTestId("permission-button");
      expect(button).toBeDisabled();
    });
  });

  describe("when user lacks permission", () => {
    beforeEach(() => {
      mockHasPermission.mockReturnValue(false);
    });

    describe("with showWhenDenied=true (default)", () => {
      it("should render a disabled button with tooltip", () => {
        render(<PermissionButton {...defaultProps} />);

        const button = screen.getByTestId("permission-button");
        expect(button).toBeDisabled();
        expect(screen.getByTestId("tooltip")).toBeInTheDocument();
      });

      it("should use custom tooltip text when provided", () => {
        const customTooltip = "Custom permission message";
        render(
          <PermissionButton {...defaultProps} tooltipText={customTooltip} />,
        );

        const tooltip = screen.getByTestId("tooltip");
        expect(tooltip).toHaveAttribute("title", customTooltip);
      });

      it("should show default tooltip for known permissions", () => {
        render(<PermissionButton {...defaultProps} permission="issue:edit" />);

        const tooltip = screen.getByTestId("tooltip");
        expect(tooltip).toHaveAttribute(
          "title",
          "This action requires: Edit existing issues",
        );
      });

      it("should show fallback tooltip for unknown permissions", () => {
        render(
          <PermissionButton
            {...defaultProps}
            permission="unknown:permission"
          />,
        );

        const tooltip = screen.getByTestId("tooltip");
        expect(tooltip).toHaveAttribute(
          "title",
          "You don't have permission to perform this action (unknown:permission)",
        );
      });
    });

    describe("with showWhenDenied=false", () => {
      it("should not render anything", () => {
        const { container } = render(
          <PermissionButton {...defaultProps} showWhenDenied={false} />,
        );

        expect(container.firstChild).toBeNull();
        expect(
          screen.queryByTestId("permission-button"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("ref forwarding", () => {
    it("should forward ref to button element", () => {
      mockHasPermission.mockReturnValue(true);
      const ref = createRef<HTMLButtonElement>();

      render(<PermissionButton {...defaultProps} ref={ref} />);

      expect(ref.current).toBe(screen.getByTestId("permission-button"));
    });
  });

  describe("prop forwarding", () => {
    it("should forward button props to MUI Button", () => {
      mockHasPermission.mockReturnValue(true);

      render(
        <PermissionButton
          {...defaultProps}
          variant="contained"
          color="primary"
        />,
      );

      const button = screen.getByTestId("permission-button");
      expect(button).toHaveAttribute("variant", "contained");
      expect(button).toHaveAttribute("color", "primary");
    });
  });
});
