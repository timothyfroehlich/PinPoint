"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Share2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { CopyButton } from "~/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  resetCollectionViewLinkAction,
  setCollectionSharingAction,
} from "~/app/(app)/c/collections/actions";

interface Props {
  collectionId: string;
  /** Current view-share token (null = sharing off). */
  viewToken: string | null;
}

/**
 * Owner-only Share panel (Wave 0b, PP-wqit.2). One toggle enables/disables the
 * public view link; a reset rotates the token to kill previously shared links.
 * The token lives in the URL path (`/c/<token>`) — never a query
 * param — so it stays out of access logs and CSP reports.
 */
export function CollectionShareDialog({
  collectionId,
  viewToken,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(viewToken);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Origin is only known client-side; set it after mount to avoid a hydration
  // mismatch. Until then the copy field shows a path-only fallback.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Keep local state in sync if the server value changes (e.g. another tab).
  useEffect(() => {
    setToken(viewToken);
  }, [viewToken]);

  const enabled = token !== null;
  const shareUrl = token !== null ? `${origin}/c/${token}` : "";

  function toggle(next: boolean): void {
    setError(null);
    startTransition(async () => {
      const result = await setCollectionSharingAction({
        collectionId,
        enabled: next,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setToken(result.data?.viewToken ?? null);
      router.refresh();
    });
  }

  function reset(): void {
    setError(null);
    startTransition(async () => {
      const result = await resetCollectionViewLinkAction({ collectionId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setToken(result.data?.viewToken ?? null);
      router.refresh();
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
          data-testid="collection-share-trigger"
        >
          <Share2 className="size-4 shrink-0" aria-hidden="true" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share collection</DialogTitle>
          <DialogDescription>
            Anyone with the view link can see this collection and its machines —
            no sign-in required. Turn it off at any time to revoke access.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <label
            htmlFor="collection-share-toggle"
            className="text-sm font-medium"
          >
            Anyone with the link can view
          </label>
          <Switch
            id="collection-share-toggle"
            checked={enabled}
            onCheckedChange={toggle}
            disabled={pending}
            data-testid="collection-share-toggle"
            aria-label="Anyone with the link can view"
          />
        </div>

        {enabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                aria-label="Shareable view link"
                data-testid="collection-share-url"
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <CopyButton value={shareUrl} aria-label="Copy view link" />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={pending}
              data-testid="collection-share-reset"
            >
              Reset link
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
