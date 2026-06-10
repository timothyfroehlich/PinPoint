"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ConfirmingDeleteButtonProps {
  /** Accessible name for the disarmed state, e.g. "Delete switch S31". */
  ariaLabel: string;
  onConfirmedDelete: () => void;
  className?: string;
}

/**
 * Two-tap destructive button: the first tap arms it (turns destructive), a
 * second tap within 3s fires the delete. Blur or timeout disarms. Replaces
 * instant single-tap deletes, which were too easy to fat-finger on touch
 * screens (a real incident: two seeded rows vanished during a review pass).
 */
export function ConfirmingDeleteButton({
  ariaLabel,
  onConfirmedDelete,
  className,
}: ConfirmingDeleteButtonProps): React.JSX.Element {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Clear the disarm timer on unmount (the row may be deleted while armed).
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  function disarm(): void {
    setArmed(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-6 transition-colors focus-visible:opacity-100 motion-reduce:transition-none",
        armed
          ? "bg-destructive/15 text-destructive hover:bg-destructive/25 hover:text-destructive"
          : "text-muted-foreground hover:text-destructive",
        className
      )}
      aria-label={
        armed ? `${ariaLabel} — activate again to confirm` : ariaLabel
      }
      title={armed ? "Tap again to confirm" : undefined}
      onClick={(e) => {
        // The row may be wrapped in a click-to-open handler (mobile row sheet);
        // arming/confirming a delete must never bubble up and open that sheet.
        e.stopPropagation();
        if (armed) {
          disarm();
          onConfirmedDelete();
          return;
        }
        setArmed(true);
        timerRef.current = window.setTimeout(() => {
          setArmed(false);
          timerRef.current = null;
        }, 3000);
      }}
      onBlur={disarm}
      onKeyDown={(e) => {
        // Keyboard users can back out of an armed state without tabbing away.
        if (e.key === "Escape") disarm();
      }}
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
    </Button>
  );
}
