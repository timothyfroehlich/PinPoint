"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { sendTestDm, type SendTestDmResult } from "./actions";

export function TestDmButton({
  disabled,
}: {
  disabled: boolean;
}): React.JSX.Element {
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<SendTestDmResult | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || pending}
        onClick={async () => {
          setPending(true);
          setResult(null);
          try {
            const r = await sendTestDm();
            setResult(r);
          } catch {
            setResult({ ok: false, reason: "transient" });
          } finally {
            setPending(false);
          }
        }}
        className="self-start"
        data-testid="discord-test-dm-button"
      >
        {pending ? "Testing..." : "Verify bot token"}
      </Button>

      {result?.ok && (
        <p className="text-sm text-success">
          Token valid — bot logged in as{" "}
          <code className="font-mono">{result.botUsername}</code>.
        </p>
      )}
      {result && !result.ok && result.reason === "not_configured" && (
        <p className="text-sm text-muted-foreground">
          Enable the integration and set a bot token first.
        </p>
      )}
      {result && !result.ok && result.reason === "invalid_token" && (
        <p className="text-sm text-destructive">
          Invalid token. Rotate it above and try again.
        </p>
      )}
      {result && !result.ok && result.reason === "transient" && (
        <p className="text-sm text-warning">
          Temporary failure
          {result.status ? ` (HTTP ${result.status})` : ""}. Try again in a
          moment.
        </p>
      )}
    </div>
  );
}
