"use client";

import { Button, Tooltip, type ButtonProps } from "@mui/material";
import { forwardRef } from "react";

import { PERMISSION_DESCRIPTIONS } from "~/server/auth/permissions.constants";

/**
 * Props for the PermissionButton component
 */
interface PermissionButtonProps extends Omit<ButtonProps, "disabled"> {
  /** The permission string to check (e.g., "issue:edit", "machine:create") */
  permission: string;
  /** Function to check if the user has the specified permission */
  hasPermission: (permission: string) => boolean;
  /**
   * Custom tooltip text to show when permission is denied
   * If not provided, uses a default message based on the permission
   */
  tooltipText?: string;
  /**
   * Whether to show the button when permission is denied
   * @default true - shows disabled button with tooltip when permission denied
   */
  showWhenDenied?: boolean;
  /**
   * Override disabled state - useful for loading states
   * The button will be disabled if either this is true OR permission is denied
   */
  disabled?: boolean;
}

/**
 * Get default tooltip text for a permission
 */
function getDefaultTooltipText(permission: string): string {
  // eslint-disable-next-line security/detect-object-injection -- permission string is validated by type system and used for predefined lookup
  const description = PERMISSION_DESCRIPTIONS[permission];
  if (description) {
    return `You don't have permission to: ${description}`;
  }
  return `You don't have permission to perform this action (${permission})`;
}

/**
 * PermissionButton - A button that automatically handles permission-based disabled states
 *
 * This component simplifies the common pattern of showing buttons that are either enabled
 * with permissions or disabled with helpful tooltips explaining the required permission.
 *
 * @example Basic usage
 * ```tsx
 * <PermissionButton
 *   permission="issue:edit"
 *   hasPermission={hasPermission}
 *   onClick={handleEdit}
 *   startIcon={<EditIcon />}
 * >
 *   Edit Issue
 * </PermissionButton>
 * ```
 *
 * @example With custom tooltip
 * ```tsx
 * <PermissionButton
 *   permission="issue:delete"
 *   hasPermission={hasPermission}
 *   onClick={handleDelete}
 *   tooltipText="You need delete permissions to remove this issue"
 *   variant="contained"
 *   color="error"
 * >
 *   Delete Issue
 * </PermissionButton>
 * ```
 *
 * @example Hide when permission denied
 * ```tsx
 * <PermissionButton
 *   permission="admin:view_logs"
 *   hasPermission={hasPermission}
 *   showWhenDenied={false}
 *   onClick={handleViewLogs}
 * >
 *   View System Logs
 * </PermissionButton>
 * ```
 */
export const PermissionButton = forwardRef<
  HTMLButtonElement,
  PermissionButtonProps
>(function PermissionButton(
  {
    permission,
    hasPermission,
    tooltipText,
    showWhenDenied = true,
    disabled: customDisabled = false,
    children,
    ...buttonProps
  },
  ref,
) {
  const hasRequiredPermission = hasPermission(permission);
  const isDisabled = customDisabled || !hasRequiredPermission;

  // If permission is denied and we shouldn't show the button, return null
  if (!hasRequiredPermission && !showWhenDenied) {
    return null;
  }

  // If button is disabled due to permission (not custom disabled), add title attribute and wrap in tooltip
  if (!hasRequiredPermission && showWhenDenied) {
    const tooltip = tooltipText ?? getDefaultTooltipText(permission);
    const buttonWithTitle = (
      <Button {...buttonProps} ref={ref} disabled={isDisabled} title={tooltip}>
        {children}
      </Button>
    );
    return (
      <Tooltip title={tooltip}>
        <span>{buttonWithTitle}</span>
      </Tooltip>
    );
  }

  const button = (
    <Button {...buttonProps} ref={ref} disabled={isDisabled}>
      {children}
    </Button>
  );

  return button;
});

export type { PermissionButtonProps };
