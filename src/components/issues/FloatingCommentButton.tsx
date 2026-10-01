"use client";

import type React from "react";
import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { AddCommentForm } from "~/components/issues/AddCommentForm";

interface FloatingCommentButtonProps {
  issueId: string;
}

/**
 * Mobile-only floating Comment button (spec issue-detail §8.3). Sits above the
 * bottom tab bar on every section tab and opens the comment composer in a
 * sheet, which closes once the comment posts.
 *
 * - Hidden from `md:` up, where the comment box sits inline in Activity
 * - z-30 stays under the tab bar's z-50; the bottom offset clears the 56px tab
 *   bar plus the safe area
 * - The caller renders it only for signed-in viewers
 */
export function FloatingCommentButton({
  issueId,
}: FloatingCommentButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+12px)] z-30 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/40 transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid="floating-comment-button"
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            Comment
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>Add a comment</SheetTitle>
            <SheetDescription className="sr-only">
              Comment on this issue. Mentions and image attachments are
              supported.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <AddCommentForm
              issueId={issueId}
              onSubmitSuccess={() => {
                setOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
