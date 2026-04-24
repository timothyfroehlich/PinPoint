"use client";

import type React from "react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  linkProviderAction,
  unlinkProviderAction,
} from "~/app/(auth)/oauth-actions";
import { providers, type ProviderKey } from "~/lib/auth/providers";

interface ConnectedAccountRowProps {
  providerKey: ProviderKey;
  displayName: string;
  isLinked: boolean;
  /** False when linked but unlinking would leave user with 0 identities. */
  canUnlink: boolean;
}

const UNLINK_DISABLED_MSG =
  "Add a password or another provider before disconnecting this one";

export function ConnectedAccountRow({
  providerKey,
  displayName,
  isLinked,
  canUnlink,
}: ConnectedAccountRowProps): React.JSX.Element {
  const Icon = providers[providerKey].iconComponent;
  const linkAction = linkProviderAction.bind(null, providerKey);
  const unlinkAction = unlinkProviderAction.bind(null, providerKey);
  const helpId = `unlink-${providerKey}-help`;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="size-5" aria-hidden />
        <div>
          <div className="font-medium">{displayName}</div>
          <div className="text-sm text-muted-foreground">
            {isLinked ? "Connected" : "Not connected"}
          </div>
        </div>
      </div>

      {isLinked ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <form action={unlinkAction}>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!canUnlink}
                    aria-describedby={!canUnlink ? helpId : undefined}
                  >
                    Disconnect {displayName}
                  </Button>
                </form>
              </span>
            </TooltipTrigger>
            {!canUnlink && (
              <TooltipContent>{UNLINK_DISABLED_MSG}</TooltipContent>
            )}
          </Tooltip>
          {!canUnlink && (
            <span className="sr-only" id={helpId}>
              {UNLINK_DISABLED_MSG}
            </span>
          )}
        </TooltipProvider>
      ) : (
        <form action={linkAction}>
          <Button type="submit">Connect {displayName}</Button>
        </form>
      )}
    </div>
  );
}
