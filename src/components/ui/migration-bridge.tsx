import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

// Bridge component for gradual MUI->shadcn migration
interface MigrationBridgeProps {
  children: ReactNode;
  useTailwind?: boolean;
  className?: string;
  muiProps?: Record<string, unknown>;
}

export function MigrationBridge({
  children,
  useTailwind = false,
  className,
  muiProps = {},
}: MigrationBridgeProps): React.JSX.Element {
  if (useTailwind) {
    return <div className={cn("migration-bridge", className)}>{children}</div>;
  }

  // Fallback to MUI pattern
  return <div {...muiProps}>{children}</div>;
}

// Helper components for common patterns
export function TailwindButton({
  children,
  variant = "default",
  size = "default",
  className,
  ...props
}: {
  children: ReactNode;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  [key: string]: unknown;
}): React.JSX.Element {
  // Import Button dynamically to avoid issues during transition
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-blue-600 text-white hover:bg-blue-700",
        variant === "outline" &&
          "border border-gray-300 bg-white hover:bg-gray-50",
        variant === "ghost" && "hover:bg-gray-100",
        size === "default" && "h-9 px-4 py-2",
        size === "sm" && "h-8 px-3 text-xs",
        size === "lg" && "h-10 px-8",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TailwindCard({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
  [key: string]: unknown;
}): React.JSX.Element {
  return (
    <div
      className={cn("rounded-lg border bg-white shadow-sm p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}
