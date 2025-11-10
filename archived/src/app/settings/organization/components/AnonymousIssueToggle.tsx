"use client";
import { useTransition, useState } from "react";
import { updateAnonymousIssueToggleAction } from "~/lib/settings/organization-actions";

interface Props {
  initialEnabled: boolean;
}
export function AnonymousIssueToggle({
  initialEnabled,
}: Props): React.JSX.Element {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Anonymous Issue Reporting</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Allow public users to submit issues via public machine pages. Rate
            limited & basic fields only.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          aria-pressed={enabled}
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            startTransition(async () => {
              const res = await updateAnonymousIssueToggleAction(next);
              if (!res.success) {
                // revert on failure
                setEnabled(!next);
              }
            });
          }}
          className={
            "inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border " +
            (enabled
              ? "bg-green-600 border-green-600"
              : "bg-gray-200 border-gray-300")
          }
        >
          <span
            className={
              "h-5 w-5 rounded-full bg-white shadow transform transition-transform " +
              (enabled ? "translate-x-5" : "translate-x-1")
            }
          />
        </button>
      </div>
      {pending && <p className="text-xs text-muted-foreground">Updating…</p>}
    </div>
  );
}
