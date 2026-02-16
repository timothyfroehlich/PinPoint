"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

/**
 * Collapsible component using native HTML details/summary.
 * Progressive enhancement - works without JavaScript.
 */

interface CollapsibleProps extends React.HTMLAttributes<HTMLDetailsElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Collapsible = React.forwardRef<HTMLDetailsElement, CollapsibleProps>(
  ({ className, open, onOpenChange, ...props }, ref) => (
    <details
      ref={ref}
      open={open}
      onToggle={(e) => {
        onOpenChange?.(e.currentTarget.open);
      }}
      className={cn(className)}
      {...props}
    />
  )
);
Collapsible.displayName = "Collapsible";

const CollapsibleTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <summary
    ref={ref}
    className={cn("cursor-pointer list-none", className)}
    {...props}
  />
));
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(className)} {...props} />
));
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
