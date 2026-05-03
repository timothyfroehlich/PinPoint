"use client";

import type React from "react";
import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { AddCommentForm } from "~/components/issues/AddCommentForm";

interface StickyCommentComposerProps {
  issueId: string;
}

/**
 * Mobile-only fixed-bottom bar that opens AddCommentForm in a Sheet.
 *
 * - Visible only below `md:` viewport (md:hidden)
 * - Positioned above the BottomTabBar (z-30 < tabbar's z-50; bottom offset clears the 56px tab bar + safe-area)
 * - Caller is responsible for gating on auth status (do not render when unauthenticated)
 */
export function StickyCommentComposer({
  issueId,
}: StickyCommentComposerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-30 border-t border-outline-variant bg-card/90 backdrop-blur-sm px-4 py-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-full border border-outline-variant bg-background px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:border-primary/40 min-h-[44px]"
          aria-label="Add a comment"
        >
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          <span>Add a comment…</span>
        </button>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>Add a comment</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <AddCommentForm issueId={issueId} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
