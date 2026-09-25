"use client";

import type React from "react";
import { useTransition, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  testDiscordDmAction,
  type TestDmResult,
} from "./test-discord-dm-action";

const REASON_COPY: Record<
  Exclude<
    TestDmResult,
    { ok: true } | { reason: "no_shared_server" }
  >["reason"],
  string
> = {
  not_authenticated: "You need to sign in again.",
  not_linked: "Link your Discord account first.",
  not_configured: "Discord integration isn't configured yet.",
  blocked:
    "Discord won't deliver to you — check that you've joined the configured Discord server and allow DMs from members.",
  rate_limited: "Rate-limited by Discord. Try again in a moment.",
  transient: "Couldn't reach Discord. Try again.",
};

export function DiscordTestDmButton(): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TestDmResult | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      {result && (
        <div
          className={
            result.ok
              ? "text-xs text-success max-w-[20rem] text-right"
              : "text-xs text-destructive-text max-w-[20rem] text-right"
          }
          role="status"
        >
          {result.ok ? (
            <p>Test DM sent</p>
          ) : result.reason === "no_shared_server" ? (
            <p>
              You don't share a server with the bot.{" "}
              {result.inviteUrl ? (
                <a
                  href={result.inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Join the server
                </a>
              ) : null}
            </p>
          ) : (
            <p>{REASON_COPY[result.reason]}</p>
          )}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              setResult(await testDiscordDmAction());
            } catch {
              // Server actions normally surface errors via the result
              // object, but a network-level failure or runtime crash
              // would reject. Fall back to transient so the user gets
              // a status message instead of a stuck spinner.
              setResult({ ok: false, reason: "transient" });
            }
          });
        }}
      >
        {pending ? "Sending…" : "Send test DM"}
      </Button>
    </div>
  );
}
