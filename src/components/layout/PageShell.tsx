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
        padded && "px-6 py-10 sm:px-8 lg:px-10",
        sizeClassName[size],
        className
      )}
    >
      {children}
    </div>
  );
}
