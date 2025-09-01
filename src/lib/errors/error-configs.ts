/**
 * Centralized Error Configuration System
 * DRY approach for consistent error handling across PinPoint
 * Phase 4C: Comprehensive Error Handling
 */

import {
  createCommonActions,
  type ErrorBoundaryConfig,
  type ErrorAction,
} from "~/components/ui/error-boundary-card";
import {
  AlertTriangle,
  Database,
  Shield,
  Wifi,
  Settings,
  FileText,
  LayoutDashboard,
  Wrench,
} from "lucide-react";

/**
 * Factory function to create error configurations with consistent patterns
 */
function createErrorConfig(
  title: string,
  description: string,
  actions: ((reset: () => void) => ErrorAction)[],
  options?: {
    icon?: React.ComponentType<{ className?: string }>;
    severity?: "error" | "warning" | "info";
    showErrorDetails?: boolean;
  },
): (reset: () => void) => ErrorBoundaryConfig {
  return (reset: () => void) => ({
    title,
    description,
    actions: actions.map((actionFactory) => actionFactory(reset)),
    icon: options?.icon ?? AlertTriangle,
    severity: options?.severity ?? "error",
    showErrorDetails: options?.showErrorDetails ?? false,
  });
}

/**
 * Pre-defined error configurations for different app contexts
 * Each function returns a configuration when passed the reset function
 */
export const errorConfigs = {
  /**
   * Global application errors
   */
  global: createErrorConfig(
    "Application Error",
    "Something went wrong with the application. This could be a temporary issue.",
    [
      createCommonActions.retry,
      createCommonActions.refresh,
      createCommonActions.support,
    ],
    { severity: "error" },
  ),

  /**
   * Issues page errors - core functionality
   */
  issues: createErrorConfig(
    "Issues Unavailable",
    "We encountered an error while loading your issue tracking system. This could be due to a database connection issue or a temporary server problem.",
    [
      createCommonActions.retry,
      createCommonActions.dashboard,
      createCommonActions.support,
    ],
    {
      icon: FileText,
      severity: "error",
    },
  ),

  /**
   * Individual issue page errors
   */
  issueDetail: createErrorConfig(
    "Issue Details Error",
    "Unable to load this specific issue. It may have been deleted or you may not have permission to view it.",
    [
      createCommonActions.retry,
      (_reset) => ({
        label: "Back to Issues",
        action: () => (window.location.href = "/issues"),
        variant: "outline" as const,
        icon: FileText,
      }),
      createCommonActions.dashboard,
    ],
    {
      icon: FileText,
      severity: "warning",
    },
  ),

  /**
   * Settings page errors - administrative functionality
   */
  settings: createErrorConfig(
    "Settings Unavailable",
    "Unable to load organization settings. This could be due to permission issues or a temporary server problem.",
    [createCommonActions.retry, createCommonActions.dashboard],
    {
      icon: Settings,
      severity: "warning",
    },
  ),

  /**
   * Dashboard errors - main entry point
   */
  dashboard: createErrorConfig(
    "Dashboard Error",
    "We're having trouble loading your dashboard. This could be a temporary server issue or a data loading problem.",
    [
      createCommonActions.retry,
      createCommonActions.refresh,
      createCommonActions.support,
    ],
    {
      icon: LayoutDashboard,
      severity: "error",
    },
  ),

  /**
   * Machine management errors
   */
  machines: createErrorConfig(
    "Machine Management Error",
    "Unable to load machine information. This could be due to a database issue or permission problem.",
    [
      createCommonActions.retry,
      createCommonActions.dashboard,
      createCommonActions.support,
    ],
    {
      icon: Wrench,
      severity: "warning",
    },
  ),

  /**
   * Authentication-related errors
   */
  auth: createErrorConfig(
    "Authentication Error",
    "There was a problem with your authentication. Please sign in again to continue.",
    [createCommonActions.signIn, createCommonActions.dashboard],
    {
      icon: Shield,
      severity: "warning",
    },
  ),

  /**
   * Database connection errors
   */
  database: createErrorConfig(
    "Database Connection Error",
    "We're unable to connect to our database. This is likely a temporary issue. Please try again in a few moments.",
    [
      createCommonActions.retry,
      createCommonActions.refresh,
      createCommonActions.support,
    ],
    {
      icon: Database,
      severity: "error",
    },
  ),

  /**
   * Network/connectivity errors
   */
  network: createErrorConfig(
    "Connection Problem",
    "We're having trouble connecting to our servers. Please check your internet connection and try again.",
    [createCommonActions.retry, createCommonActions.refresh],
    {
      icon: Wifi,
      severity: "warning",
    },
  ),

  /**
   * Permission/authorization errors
   */
  permission: createErrorConfig(
    "Access Denied",
    "You don't have permission to access this resource. Contact your administrator if you believe this is an error.",
    [createCommonActions.dashboard, createCommonActions.support],
    {
      icon: Shield,
      severity: "warning",
    },
  ),
};

/**
 * Helper function to get error config by type
 * Provides type safety and fallback to global config
 */
export function getErrorConfig(
  type: keyof typeof errorConfigs,
  reset: () => void,
): ErrorBoundaryConfig {
  const configFactory = errorConfigs[type];
  return configFactory(reset);
}

/**
 * Error type detection based on error message patterns
 * Helps automatically determine appropriate error configuration
 */
export function detectErrorType(error: Error): keyof typeof errorConfigs {
  const message = error.message.toLowerCase();

  // Authentication errors
  if (
    message.includes("unauthorized") ||
    message.includes("auth") ||
    message.includes("token")
  ) {
    return "auth";
  }

  // Database errors
  if (
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("query")
  ) {
    return "database";
  }

  // Network errors
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout")
  ) {
    return "network";
  }

  // Permission errors
  if (
    message.includes("permission") ||
    message.includes("forbidden") ||
    message.includes("access denied")
  ) {
    return "permission";
  }

  // Default to global
  return "global";
}
