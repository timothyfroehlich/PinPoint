"use client";

import type React from "react";
import { useId } from "react";
import { cn } from "~/lib/utils";

/**
 * A titled section of the machine form: the title above, the fields in a
 * bordered box (machine-editing 3.1). Same markup as the Model Details box
 * inside `PinballMapLinkField`, which predates this and owns its own copy.
 */
export function FormSectionBox({
  title,
  testId,
  className,
  children,
}: {
  title: string;
  testId?: string;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const headingId = useId();
  return (
    <div className="space-y-1.5">
      <h3
        id={headingId}
        className="text-sm leading-none font-medium text-foreground"
      >
        {title}
      </h3>
      <section
        aria-labelledby={headingId}
        data-testid={testId}
        className={cn(
          "flex flex-col gap-3.5 rounded-lg border border-outline-variant p-4",
          className
        )}
      >
        {children}
      </section>
    </div>
  );
}
