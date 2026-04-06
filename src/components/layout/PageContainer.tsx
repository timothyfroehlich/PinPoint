import type React from "react";
import { cn } from "~/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  size?: "narrow" | "standard" | "wide" | "full";
  className?: string;
}

const sizeClasses = {
  narrow: "max-w-3xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl",
  full: "",
} as const;

export function PageContainer({
  children,
  size = "standard",
  className,
}: PageContainerProps): React.JSX.Element {
  return (
    <div
      className={cn("mx-auto py-10 space-y-6", sizeClasses[size], className)}
    >
      {children}
    </div>
  );
}
