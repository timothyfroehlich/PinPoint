"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "~/lib/utils";

function Accordion({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="accordion"
      className={cn("space-y-0", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<"details">): React.JSX.Element {
  return (
    <details
      data-slot="accordion-item"
      className={cn("group border-b last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<"summary">): React.JSX.Element {
  return (
    <summary
      data-slot="accordion-trigger"
      className={cn(
        "flex cursor-pointer list-none items-center justify-between py-4 text-left text-sm font-medium transition-all hover:underline [&::-webkit-details-marker]:hidden",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
    </summary>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="accordion-content"
      className={cn("pb-4 text-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
