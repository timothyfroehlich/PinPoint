import type React from "react";
import { cn } from "~/lib/utils";

type PageShellSize = "default" | "wide" | "narrow";

interface PageShellProps {
  children: React.ReactNode;
  size?: PageShellSize;
  className?: string;
  padded?: boolean;
}

const sizeClassName: Record<PageShellSize, string> = {
  default: "max-w-6xl",
  wide: "max-w-7xl",
  narrow: "max-w-3xl",
};

export function PageShell({
  children,
  size = "default",
  className,
  padded = true,
}: PageShellProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        padded && "px-4 py-6 sm:px-8 sm:py-10 lg:px-10",
        sizeClassName[size],
        className
      )}
    >
      {children}
    </div>
  );
}
