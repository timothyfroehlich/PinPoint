"use client";

import * as React from "react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { CircleAlert, MapPin, TriangleAlert } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordInput } from "~/components/ui/password-input";
import {
  linkPinballMapAccountAction,
  unlinkPinballMapAccountAction,
  type LinkPinballMapActionResult,
} from "~/app/(app)/settings/pinballmap/actions";
import type { PinballMapLinkState } from "~/lib/pinballmap/types";

interface PinballMapAccountRowProps {
  status: PinballMapLinkState;
  /** The Pinball Map username the link was made as; null when not linked. */
  username: string | null;
}

/**
 * The member's Pinball Map link in Connected Accounts (pinballmap spec 8.4–8.5).
 *
 * Three states: not linked (Link), linked (Unlink), and authentication failed —
 * Pinball Map refused the saved token on a push — which keeps the row and offers
 * Reconnect, the same sign-in dialog as Link.
 */
export function PinballMapAccountRow({
  status,
  username,
}: PinballMapAccountRowProps): React.JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);
  // Bumped on every open. Keying the dialog on it remounts the form, so a
  // failed attempt's login, password, and error never greet the next open.
  const [openCount, setOpenCount] = useState(0);

  return (
    <div
      id="pinball-map"
      className="flex items-center justify-between gap-4 py-3"
      data-testid="pinballmap-account-row"
    >
      <div className="flex items-center gap-3">
        <MapPin className="size-5" aria-hidden />
        <div>
          <div className="font-medium">Pinball Map</div>
          <div
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
            data-testid="pinballmap-account-status"
          >
            {status === "not_linked" ? (
              "Not linked"
            ) : status === "linked" ? (
              <>
                Linked as{" "}
                <span className="text-foreground">{username ?? "—"}</span>
              </>
            ) : (
              <>
                <TriangleAlert
                  className="size-4 text-warning"
                  aria-hidden="true"
                />
                <span className="font-medium text-warning">
                  Authentication failed
                </span>
              </>
            )}
          </div>
          {status === "needs_relink" && username !== null ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Was linked as {username}.
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status === "linked" ? null : (
          <Button
            type="button"
            onClick={() => {
              setOpenCount((n) => n + 1);
              setDialogOpen(true);
            }}
          >
            {status === "not_linked" ? "Link Pinball Map" : "Reconnect"}
          </Button>
        )}
        {status === "not_linked" ? null : <UnlinkButton />}
      </div>

      <LinkDialog
        key={openCount}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          status === "needs_relink"
            ? "Reconnect Pinball Map"
            : "Link Pinball Map"
        }
      />
    </div>
  );
}

function LinkDialog({
  open,
  onOpenChange,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState<
    LinkPinballMapActionResult | undefined,
    FormData
  >(linkPinballMapAccountAction, undefined);
  // Controlled so a failed attempt keeps the login: React resets an
  // uncontrolled form after its action runs, and the member should only have
  // to retype the password.
  const [login, setLogin] = useState("");

  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Sign in with your Pinball Map account. PinPoint keeps the
            account&apos;s access token and never stores your password.
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          className="space-y-4"
          data-testid="pinballmap-link-form"
        >
          <div className="space-y-2">
            <Label htmlFor="pbm-login">Username or email</Label>
            <Input
              id="pbm-login"
              name="login"
              value={login}
              onChange={(event) => {
                setLogin(event.target.value);
              }}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={255}
              enterKeyHint="next"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pbm-password">Password</Label>
            <PasswordInput
              id="pbm-password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              enterKeyHint="done"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            No account?{" "}
            <a
              href="https://pinballmap.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              Create one on Pinball Map
            </a>
          </p>
          {state && !state.ok ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive-text"
              data-testid="pinballmap-link-error"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
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
            <Button type="submit" disabled={pending}>
              {pending ? "Linking…" : "Link account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UnlinkButton(): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={pending}>
          Unlink
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unlink Pinball Map?</AlertDialogTitle>
          <AlertDialogDescription>
            PinPoint deletes its copy of your Pinball Map token. Pinball Map has
            no way to revoke a token, so the token itself stays valid on their
            side.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error !== null ? (
          <p role="alert" className="text-sm text-destructive-text">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await unlinkPinballMapAccountAction();
                if (!result.ok) setError(result.message);
              });
            }}
          >
            {pending ? "Unlinking…" : "Unlink"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
