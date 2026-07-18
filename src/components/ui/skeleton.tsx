import React from "react";
import { cn } from "~/lib/utils";

function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-accent animate-pulse motion-reduce:animate-none rounded-md",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
