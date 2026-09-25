"use client";

import type React from "react";
import { useState, useTransition } from "react";

import { setInsiderConnectedAction } from "~/app/(app)/m/pinballmap-actions";
import { Button } from "~/components/ui/button";
import type {
  PbmInsiderConnectedSetting,
  PbmInsiderConnectedView,
} from "~/lib/pinballmap/insider-connected";

const SETTING_LABEL: Record<PbmInsiderConnectedSetting, string> = {
  on: "On",
  off: "Off",
  not_set: "Not set",
};

/**
 * The entry's Insider Connected setting, under the listing control (spec 3.8).
 *
 * A separate line rather than a third row inside the control: the control keeps
 * one fixed height in every state (4.1), and this line exists only for an
 * eligible title with its entry on the lineup.
 *
 * The action names the state it sets, and the server sends that state rather
 * than a flip, so a stale page cannot invert the setting. No confirmation: the
 * change is reversible from the same line, unlike Remove.
 */
export function PinballmapInsiderConnected({
  machineId,
  view,
  canChange,
}: {
  machineId: string;
  view: PbmInsiderConnectedView;
  /** Viewer holds the push capability AND an operator credential exists (8.2). */
  canChange: boolean;
}): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(): void {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("machineId", machineId);
      formData.set("enabled", view.target ? "true" : "false");
      const result = await setInsiderConnectedAction(undefined, formData);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div data-testid="pbm-insider-connected">
      <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Insider Connected
        </span>
        <span
          className={
            view.setting === "not_set"
              ? "text-sm text-muted-foreground"
              : "text-sm text-foreground"
          }
          data-testid="pbm-insider-connected-setting"
        >
          {SETTING_LABEL[view.setting]}
        </span>
        {canChange ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            loading={pending}
            onClick={change}
            data-testid="pbm-insider-connected-change"
          >
            {view.target
              ? "Turn on Insider Connected"
              : "Turn off Insider Connected"}
          </Button>
        ) : null}
      </div>
      {error !== null ? (
        <p
          className="mt-1 text-xs text-destructive-text"
          role="alert"
          data-testid="pbm-insider-connected-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
