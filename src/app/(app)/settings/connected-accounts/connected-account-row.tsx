"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
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

function UnlinkSubmitButton({
  displayName,
}: {
  displayName: string;
}): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
    >
      {pending ? "Disconnecting..." : `Disconnect ${displayName}`}
    </Button>
  );
}

export function ConnectedAccountRow({
  providerKey,
  displayName,
  isLinked,
  canUnlink,
  secondaryAction,
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

      <div className="flex items-center gap-2">
        {secondaryAction}
        {isLinked ? (
          <>
            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={!canUnlink}
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
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  {/* Submits through the action prop rather than an onClick
                      handler (CORE-ARCH-005). This in-dialog form is the
                      normal path; the <noscript> form below covers the case
                      where the dialog never opens. */}
                  <form action={unlinkAction}>
                    <UnlinkSubmitButton displayName={displayName} />
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {/* No-JS fallback. AlertDialog needs Radix's client JS to open,
                so without JS the in-dialog form above is unreachable; the
                browser hides <noscript> content when scripts run, so this
                form only surfaces when JS is disabled.

                Kept, not required. No surface owes a no-JS path any more
                (PP-nw80) — this is the one place that ever engineered one,
                it costs nothing, and unlinking an identity provider is worth
                a belt-and-braces escape hatch. Delete it freely if it ever
                gets in the way. */}
            {canUnlink && (
              <noscript>
                <form action={unlinkAction}>
                  <Button type="submit" variant="destructive">
                    Disconnect {displayName}
                  </Button>
                </form>
              </noscript>
            )}
          </>
        ) : (
          <form action={linkAction}>
            <Button type="submit">Connect {displayName}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
