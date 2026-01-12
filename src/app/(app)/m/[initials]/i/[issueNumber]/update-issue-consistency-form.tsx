"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssueConsistencyAction,
  type UpdateIssueConsistencyResult,
} from "~/app/(app)/issues/actions";
import { ConsistencySelect } from "~/components/issues/fields/ConsistencySelect";
import { type IssueConsistency } from "~/lib/types";

interface UpdateIssueConsistencyFormProps {
  issueId: string;
  currentConsistency: IssueConsistency;
}

export function UpdateIssueConsistencyForm({
  issueId,
  currentConsistency,
}: UpdateIssueConsistencyFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedConsistency, setSelectedConsistency] =
    useState<IssueConsistency>(currentConsistency);
  const [pendingConsistency, setPendingConsistency] =
    useState<IssueConsistency | null>(null);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueConsistencyResult | undefined,
    FormData
  >(updateIssueConsistencyAction, undefined);

  // Auto-submit form when pending consistency changes
  useEffect(() => {
    if (pendingConsistency !== null && formRef.current) {
      formRef.current.requestSubmit();
      setPendingConsistency(null);
    }
  }, [pendingConsistency]);

  const handleValueChange = (newConsistency: IssueConsistency): void => {
    setSelectedConsistency(newConsistency);
    setPendingConsistency(newConsistency);
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-consistency"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="consistency" value={selectedConsistency} />
      <div className="relative">
        <ConsistencySelect
          value={selectedConsistency}
          onValueChange={handleValueChange}
          disabled={isPending}
        />
        {isPending && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
