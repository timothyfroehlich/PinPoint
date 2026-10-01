"use client";

import type React from "react";
import { useCallback, useRef, useState } from "react";
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
import { useActiveIssueSection } from "~/components/issues/IssueSectionTabs";

interface FloatingCommentButtonProps {
  issueId: string;
}

/**
 * Mobile-only floating Comment button (spec issue-detail §8.3). Sits above the
 * bottom tab bar on the Issue tab only — the tab that shows Activity — and
 * opens the comment composer in a sheet, which closes once the comment posts.
 *
 * - Renders inside `IssueSections`, which says which tab is showing
 * - Hidden from `md:` up, where the comment box sits inline in Activity
 * - z-30 stays under the tab bar's z-50; the bottom offset clears the 56px tab
 *   bar plus the safe area
 * - `data-floating-comment` lets the app shell add scroll padding so focused
 *   content never lands under the button (WCAG 2.4.11)
 * - The caller renders it only for signed-in viewers
 */
export function FloatingCommentButton({
  issueId,
}: FloatingCommentButtonProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const section = useActiveIssueSection();
  // The comment just posted, to bring into view once the sheet closes.
  const postedIdRef = useRef<string | null>(null);

  // Stable, so the composer's success effect never re-runs for one post.
  const handlePosted = useCallback((commentId: string) => {
    postedIdRef.current = commentId;
    setOpen(false);
  }, []);

  if (section !== "issue") return null;

  return (
    <div
      className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+12px)] z-30 md:hidden"
      data-floating-comment
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid="floating-comment-button"
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            Comment
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[80dvh] gap-0 overflow-y-auto"
          // A 44px close target (spec §13.2), centered on the title line.
          closeClassName="top-1.5 right-1.5 flex size-11 items-center justify-center rounded-md"
          // After a post, show the new comment and move focus to it, rather
          // than back to the Comment button.
          onCloseAutoFocus={(event) => {
            const postedId = postedIdRef.current;
            postedIdRef.current = null;
            const posted = postedId
              ? document.getElementById(`comment-${postedId}`)
              : null;
            if (!posted) return;
            event.preventDefault();
            posted.scrollIntoView({ block: "center" });
            if (!posted.hasAttribute("tabindex")) {
              posted.setAttribute("tabindex", "-1");
            }
            posted.focus({ preventScroll: true });
          }}
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">Add a comment</SheetTitle>
            <SheetDescription className="sr-only">
              Comment on this issue. Mentions and image attachments are
              supported.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <AddCommentForm
              issueId={issueId}
              quick
              onSubmitSuccess={handlePosted}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
