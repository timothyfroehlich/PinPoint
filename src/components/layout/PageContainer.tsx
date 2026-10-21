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
      className={cn(
        // A List View's phone pager ends the page, directly above the tab
        // bar (list-views §7.8; MainLayout keeps the tab bar's clearance).
        "mx-auto pt-6 pb-10 space-y-6 max-md:has-[[data-list-phone-pager]]:pb-0",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  );
}
