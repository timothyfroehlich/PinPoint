"use client";

import type React from "react";
import { useActionState, useEffect, useState } from "react";

import {
  convertPinballMapCommentAction,
  type ConvertPinballMapCommentResult,
} from "~/app/(app)/m/[initials]/(tabs)/timeline/pinballmap-comment-actions";
import { SeveritySelect } from "~/components/issues/fields/SeveritySelect";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  ISSUE_TITLE_MAX,
  suggestIssueTitle,
} from "~/lib/pinballmap/comment-conversion";
import type { IssueSeverity } from "~/lib/types";

interface Props {
  machineId: string;
  conditionId: number;
  comment: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Convert an imported Pinball Map comment to an issue (pinballmap spec 7.5).
 *
 * The person confirms a title (suggested from the comment) and chooses the
 * severity — Pinball Map says nothing about severity, so none is assumed. The
 * comment itself becomes the issue description with its attribution. Success
 * redirects to the new issue; only failures return here.
 */
export function ConvertPinballMapCommentDialog({
  machineId,
  conditionId,
  comment,
  open,
  onOpenChange,
}: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    ConvertPinballMapCommentResult | undefined,
    FormData
  >(convertPinballMapCommentAction, undefined);
  const [title, setTitle] = useState(() => suggestIssueTitle(comment));
  const [severity, setSeverity] = useState<IssueSeverity | "">("");

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (open) {
      setTitle(suggestIssueTitle(comment));
      setSeverity("");
    }
  }, [open, comment]);

  const titleId = `pbm-convert-title-${String(conditionId)}`;
  const severityId = `pbm-convert-severity-${String(conditionId)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Convert to issue</DialogTitle>
            <DialogDescription>
              The comment becomes the issue description.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="machineId" value={machineId} />
          <input type="hidden" name="conditionId" value={conditionId} />
          <blockquote className="max-h-32 overflow-y-auto border-l-2 border-outline-variant pl-3 text-sm whitespace-pre-line text-muted-foreground">
            {comment}
          </blockquote>
          <div className="flex flex-col gap-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              name="title"
              value={title}
              maxLength={ISSUE_TITLE_MAX}
              required
              onChange={(e) => {
                setTitle(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={severityId}>Severity</Label>
            {/* Controlled + hidden input: Radix Select does not reliably
                submit its value with a native form (pinpoint-ui). */}
            <SeveritySelect
              id={severityId}
              name="severity-select"
              value={severity}
              onValueChange={setSeverity}
              testId="pbm-convert-severity"
            />
            <input type="hidden" name="severity" value={severity} />
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-sm text-destructive-text">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || severity === "" || title.trim() === ""}
            >
              {isPending ? "Converting…" : "Convert to issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
