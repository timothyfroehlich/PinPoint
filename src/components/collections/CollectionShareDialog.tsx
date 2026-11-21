"use client";

import type React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { CopyButton } from "~/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { setCollectionSharingAction } from "~/app/(app)/c/collections/actions";
import { CollectionCollaborators } from "./CollectionCollaborators";
import type { CollaboratorUser } from "~/lib/collections/collaborators";

interface Props {
  /** The dialog opens from Share in the page actions (collections-and-tags 4.15). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  /** Current view-share token (null = sharing off). */
  viewToken: string | null;
  /** Owner's display name, for the top row of "People with access". */
  ownerName: string;
  /** Current editor collaborators. */
  editors: CollaboratorUser[];
  /** All grantable members (owner excluded) for the add-people picker. */
  grantableMembers: CollaboratorUser[];
  /** Where focus goes when the dialog closes (useReturnFocus). */
  onCloseAutoFocus?: ((event: Event) => void) | undefined;
}

/**
 * Owner-only Share panel (Wave 0b, PP-wqit.2). One toggle enables/disables the
 * public view link. The token lives in the URL path (`/c/<token>`) — never a
 * query param — so it stays out of access logs and CSP reports.
 */
export function CollectionShareDialog({
  open,
  onOpenChange,
  collectionId,
  viewToken,
  ownerName,
  editors,
  grantableMembers,
  onCloseAutoFocus,
}: Props): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
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
      // Disabling sharing nulls the token, so if the owner is viewing via the
      // now-dead `/c/<token>` URL a plain refresh would re-resolve the stale
      // token and 404. Redirect to the canonical `/c/<id>` only in that case:
      // any path under the canonical uuid (overview or a tab like `…/issues`)
      // stays valid, so refresh in place and keep the owner on their tab.
      const canonical = `/c/${collectionId}`;
      if (pathname.startsWith(canonical)) {
        router.refresh();
      } else {
        router.replace(canonical);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={onCloseAutoFocus}
      >
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
        )}

        {error && (
          <p className="text-sm text-destructive-text" role="alert">
            {error}
          </p>
        )}

        <div className="h-px bg-border" />

        <CollectionCollaborators
          collectionId={collectionId}
          ownerName={ownerName}
          editors={editors}
          grantableMembers={grantableMembers}
        />
      </DialogContent>
    </Dialog>
  );
}
