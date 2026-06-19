"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { cn } from "~/lib/utils";
import { useIsMobile } from "~/hooks/use-is-mobile";

interface ConfirmingDeleteButtonProps {
  /** Accessible name for the disarmed state, e.g. "Delete switch S31". */
  ariaLabel: string;
  onConfirmedDelete: () => void;
  className?: string;
}

/**
 * Per-row destructive button — design splits on viewport:
 *
 * Desktop: two-tap arm/confirm (3s timeout). The armed state expands to
 * ~2× width with explicit "Tap again to delete" copy so the affordance is
 * discoverable rather than just turning red (bug #4a, PP-43q3).
 *
 * Mobile: single tap opens an AlertDialog ("Delete this row?" / Delete /
 * Cancel). Replaces the invisible two-tap with a modal that is obviously
 * destructive. `use-is-mobile` is the sanctioned JS responsive exception
 * (CORE-RESP / PP-43q3) — using it here is explicitly allowed.
 *
 * Both: `e.stopPropagation()` ensures a tap never bubbles to the row's
 * sheet-open handler.
 */
export function ConfirmingDeleteButton({
  ariaLabel,
  onConfirmedDelete,
  className,
}: ConfirmingDeleteButtonProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [armed, setArmed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // ── Mobile branch ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-6 text-muted-foreground hover:text-destructive transition-colors motion-reduce:transition-none",
            className
          )}
          aria-label={ariaLabel}
          onClick={(e) => {
            // Never bubble to the row's sheet-open handler.
            e.stopPropagation();
            setDialogOpen(true);
          }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this row?</AlertDialogTitle>
              <AlertDialogDescription>
                This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() => {
                  setDialogOpen(false);
                  onConfirmedDelete();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ── Desktop branch ───────────────────────────────────────────────────────
  return (
    <Button
      variant="ghost"
      size={armed ? "sm" : "icon"}
      className={cn(
        "transition-[width,colors] focus-visible:opacity-100 motion-reduce:transition-none",
        armed
          ? "w-auto px-2 h-6 bg-destructive/15 text-destructive hover:bg-destructive/25 hover:text-destructive"
          : "size-6 text-muted-foreground hover:text-destructive",
        className
      )}
      aria-label={armed ? `Tap again to delete — ${ariaLabel}` : ariaLabel}
      onClick={(e) => {
        // Never bubble to the row's sheet-open handler.
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
      {armed ? (
        <span className="flex items-center gap-1.5">
          <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
          Tap again to delete
        </span>
      ) : (
        <Trash2 className="size-3.5" aria-hidden="true" />
      )}
    </Button>
  );
}
