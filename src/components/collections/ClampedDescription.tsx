"use client";

import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface Props {
  /** The rendered description (a server-rendered RichTextDisplay). */
  children: React.ReactNode;
}

/**
 * A Collection's description under its header (spec collections-and-tags
 * 4.7): clamped to three lines, with a Show more / Show less toggle that
 * appears only when the text runs past three lines.
 *
 * Overflow is measured on the element itself (scrollHeight vs clientHeight
 * while clamped), re-measured when its box resizes. That is a property of the
 * content, not viewport detection, so CSS can't answer it.
 */
export function ClampedDescription({ children }: Props): React.JSX.Element {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    // Measure only while clamped; expanded, the toggle must stay to collapse.
    const el = ref.current;
    if (!el || expanded) return;
    const measure = (): void => {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, children]);

  return (
    <div className="max-w-3xl" data-testid="collection-description">
      <div
        id={id}
        ref={ref}
        className={cn("text-sm text-foreground", !expanded && "line-clamp-3")}
      >
        {children}
      </div>
      {overflows ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
