"use client";

import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface Props {
  /** The rendered description (a server-rendered RichTextDisplay). */
  children: React.ReactNode;
}

const toggleClass =
  "rounded-sm text-[13px] leading-[21px] text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * A Collection's description in its header (spec collections-and-tags 4.7,
 * 4.12): clamped to three lines, or two below the md breakpoint. Longer
 * text ends its last shown line with an inline "… Show more"; expanded, a
 * Show less under the text returns it to its clamped length. A link inside
 * the clamped text that takes keyboard focus shows the whole text, so focus
 * never lands on a hidden link; a pointer click on a shown link does not.
 * Show more and Show less are separate buttons, so the one that appears
 * takes focus from the one that was pressed.
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
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Set when a toggle is pressed, so the toggle that replaces it takes focus.
  const toggled = useRef(false);

  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    toggleRef.current?.focus();
  }, [expanded]);

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
    <div
      className="group/description relative text-sm/[21px]"
      data-testid="collection-description"
    >
      <div
        id={id}
        ref={ref}
        className={cn(
          "text-foreground-secondary",
          !expanded &&
            "line-clamp-2 has-[a:focus-visible]:line-clamp-none md:line-clamp-3"
        )}
      >
        {children}
      </div>
      {overflows && !expanded ? (
        // Over the end of the last shown line, fading the text beneath it
        // into the page background.
        <button
          type="button"
          ref={toggleRef}
          aria-expanded={false}
          aria-controls={id}
          onClick={() => {
            toggled.current = true;
            setExpanded(true);
          }}
          className={cn(
            toggleClass,
            "absolute right-0 bottom-0 bg-[linear-gradient(to_right,transparent,var(--color-background)_24px)] pl-6 group-has-[a:focus-visible]/description:hidden"
          )}
        >
          <span aria-hidden="true">… </span>Show more
        </button>
      ) : null}
      {overflows && expanded ? (
        <button
          type="button"
          ref={toggleRef}
          aria-expanded={true}
          aria-controls={id}
          onClick={() => {
            toggled.current = true;
            setExpanded(false);
          }}
          className={toggleClass}
        >
          Show less
        </button>
      ) : null}
    </div>
  );
}
