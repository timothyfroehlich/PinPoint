"use client";

import * as React from "react";
import { useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
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
  /** Optional secondary action rendered alongside the primary button (e.g. test DM). */
  secondaryAction?: React.ReactNode;
}

const UNLINK_DISABLED_MSG =
  "Add a password or another provider before disconnecting this one";

export function ConnectedAccountRow({
  providerKey,
  displayName,
  isLinked,
  canUnlink,
  secondaryAction,
}: ConnectedAccountRowProps): React.JSX.Element {
  const Icon = providers[providerKey].iconComponent;
  const linkAction = linkProviderAction.bind(null, providerKey);
  const helpId = `unlink-${providerKey}-help`;
  const [isPending, startTransition] = useTransition();

  function handleUnlink(): void {
    startTransition(async () => {
      await unlinkProviderAction(providerKey);
    });
  }

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

      <div className="flex items-center gap-2">
        {secondaryAction}
        {isLinked ? (
          <AlertDialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={!canUnlink || isPending}
                        aria-describedby={!canUnlink ? helpId : undefined}
                      >
                        Disconnect {displayName}
                      </Button>
                    </AlertDialogTrigger>
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
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect {displayName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You can re-link {displayName} at any time, but you&apos;ll
                  need to sign in again to do so.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleUnlink}
                  disabled={isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending ? "Disconnecting..." : `Disconnect ${displayName}`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <form action={linkAction}>
            <Button type="submit">Connect {displayName}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
