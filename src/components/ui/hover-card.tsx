"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "~/lib/utils";

function HoverCard(
  props: React.ComponentProps<typeof HoverCardPrimitive.Root>
): React.JSX.Element {
  return (
    <HoverCardPrimitive.Root
      data-slot="hover-card"
      openDelay={150}
      closeDelay={100}
      {...props}
    />
  );
}

function HoverCardTrigger(
  props: React.ComponentProps<typeof HoverCardPrimitive.Trigger>
): React.JSX.Element {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

function HoverCardContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>): React.JSX.Element {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground z-50 w-64 rounded-md border p-3 shadow-md outline-none",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
