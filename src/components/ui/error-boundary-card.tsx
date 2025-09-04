/**
 * Reusable Error Boundary Card Component
 * DRY approach for consistent error handling across PinPoint
 * Phase 4C: Error Handling and Recovery
 */

"use client";

import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { AlertTriangle, RefreshCw, Home, HelpCircle } from "lucide-react";
import { isDevelopment } from "~/lib/environment-client";
import { getErrorMessage } from "~/lib/utils/type-guards";

export interface ErrorAction {
  label: string;
  action: () => void;
  variant?:
    | "default"
    | "outline"
    | "destructive"
    | "secondary"
    | "ghost"
    | "link";
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ErrorBoundaryConfig {
  title: string;
  description: string;
  actions: ErrorAction[];
  showErrorDetails?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  severity?: "error" | "warning" | "info";
}

interface ErrorBoundaryCardProps {
  error: Error & { digest?: string };
  reset: () => void;
  config: ErrorBoundaryConfig;
}

/**
 * Reusable error boundary card that follows PinPoint's design patterns
 * Integrates with existing shadcn/ui components for consistency
 */
export function ErrorBoundaryCard({
  error,
  reset: _reset,
  config,
}: ErrorBoundaryCardProps): JSX.Element {
  const {
    title,
    description,
    actions,
    // Development environment detection for error details display
    showErrorDetails = isDevelopment(),
    icon: Icon = AlertTriangle,
    severity = "error",
  } = config;

  useEffect(() => {
    // Log error for monitoring (future integration point)
    console.error("ErrorBoundary caught error:", {
      message: getErrorMessage(error),
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const getSeverityColors = (severity: string): {
    iconBg: string;
    iconColor: string;
    titleColor: string;
  } => {
    switch (severity) {
      case "warning":
        return {
          iconBg: "bg-secondary-container",
          iconColor: "text-on-secondary-container",
          titleColor: "text-on-secondary-container",
        };
      case "info":
        return {
          iconBg: "bg-primary-container",
          iconColor: "text-on-primary-container",
          titleColor: "text-on-primary-container",
        };
      default:
        return {
          iconBg: "bg-error-container",
          iconColor: "text-on-error-container",
          titleColor: "text-on-error-container",
        };
    }
  };

  const colors = getSeverityColors(severity);

  return (
    <div className="container mx-auto px-4 py-8" data-testid="error-boundary-card">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div
            className={`mx-auto w-12 h-12 ${colors.iconBg} rounded-full flex items-center justify-center mb-4`}
          >
            <Icon className={`w-6 h-6 ${colors.iconColor}`} />
          </div>
          <CardTitle className={`text-xl font-semibold ${colors.titleColor}`}>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">{description}</p>

          {/* Error digest for support */}
          {error.digest && (
            <div className="text-center">
              <Badge variant="outline" className="text-xs">
                Error ID: {error.digest}
              </Badge>
            </div>
          )}

          {/* Development error details */}
          {showErrorDetails && (
            <div className="bg-muted p-4 rounded text-sm">
              <strong>Error details:</strong>
              <pre className="mt-2 whitespace-pre-wrap">{getErrorMessage(error)}</pre>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            {actions.map((actionItem, index) => {
              const ActionIcon = actionItem.icon;
              return (
                <Button
                  key={index}
                  variant={actionItem.variant ?? "default"}
                  onClick={actionItem.action}
                  className="flex items-center gap-2"
                >
                  {ActionIcon && <ActionIcon className="w-4 h-4" />}
                  {actionItem.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Common action factories for consistent error recovery
 * Follows PinPoint's navigation patterns
 */
export const createCommonActions = {
  retry: (reset: () => void): ErrorAction => ({
    label: "Try Again",
    action: reset,
    variant: "default",
    icon: RefreshCw,
  }),

  dashboard: (): ErrorAction => ({
    label: "Return to Dashboard",
    action: () => (window.location.href = "/dashboard"),
    variant: "outline",
    icon: Home,
  }),

  support: (): ErrorAction => ({
    label: "Contact Support",
    action: () =>
      (window.location.href =
        "mailto:support@pinpoint.com?subject=Application Error"),
    variant: "outline",
    icon: HelpCircle,
  }),

  refresh: (): ErrorAction => ({
    label: "Refresh Page",
    action: () => {
      window.location.reload();
    },
    variant: "secondary",
    icon: RefreshCw,
  }),

  signIn: (): ErrorAction => ({
    label: "Sign In",
    action: () => (window.location.href = "/auth/sign-in"),
    variant: "default",
  }),
};
