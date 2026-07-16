"use client";

import type React from "react";
import { useActionState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  MapPin,
} from "lucide-react";
import {
  linkPinballmapEntryAction,
  verifyPinballmapLinkAction,
} from "~/app/(app)/m/pinballmap-actions";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

/**
 * "Connect to PinballMap" — the state-aware control that replaces the old
 * disabled "List on PinballMap" checkbox (PP-o355.12, read side).
 *
 * A machine linked to a PBM catalog title is in one of four listing states; a
 * plain checkbox can't express them, and checking it for an already-on-PBM
 * machine would fire a duplicate WRITE when the right move is a read-only LINK.
 * This control resolves the machine's title against our stored location lineup
 * and branches:
 *
 *  1. **not listed / on-PBM-but-unlinked** (`!listed`, no lmx) → "Connect to
 *     PinballMap": one read-only lineup lookup that either captures the existing
 *     entry (→ listed) or reports the title isn't on the lineup yet.
 *  2. **listed + linked** (lmx set) → "Listed" + "Verify" (re-check the link).
 *  3. **link broken** (a Verify came back stale) → "⚠ Reconnect".
 *
 * Read-only: link/verify only READ PBM's public lineup (anonymous, no token) and
 * are gated by `machines.pinballmap.link`. The WRITE verbs (List a brand-new
 * machine, Unlist) need the operator token and land in the follow-up PR; until
 * then the deep link to pinballmap.com is the fallback (CORE-PBM-001 link-back).
 *
 * Rendered as its own `<form>` region — NOT nested in the machine-edit form
 * (nested forms are invalid HTML), so it lives beside that form in the dialog.
 */
export interface PinballmapListingControlProps {
  machineId: string;
  /** Machine is linked to a PBM catalog title (a listing presupposes a title). */
  hasCatalogLink: boolean;
  /** Persisted "listed on PinballMap" flag. */
  listed: boolean;
  /** Persisted captured location_machine_xref id (null until captured). */
  lmxId: number | null;
  /** Viewer may link/verify (`machines.pinballmap.link` — owner/tech/admin). */
  canLink: boolean;
  /** Public pinballmap.com deep link for attribution + the write fallback. */
  pinballmapUrl: string;
}

function PbmDeepLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-secondary underline-offset-2 hover:underline"
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-3.5" />
    </a>
  );
}

export function PinballmapListingControl({
  machineId,
  hasCatalogLink,
  listed,
  lmxId,
  canLink,
  pinballmapUrl,
}: PinballmapListingControlProps): React.JSX.Element | null {
  const [linkState, linkAction, linkPending] = useActionState(
    linkPinballmapEntryAction,
    undefined
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyPinballmapLinkAction,
    undefined
  );

  // A listing presupposes a catalog title; nothing to show until one is linked
  // (the PinballMapLinkField above handles picking the title).
  if (!hasCatalogLink) return null;

  const linkAbsent = linkState && !linkState.ok && linkState.code === "ABSENT";
  const verifiedStale =
    verifyState?.ok === true && verifyState.value.state === "stale";
  const verifiedHealed =
    verifyState?.ok === true && verifyState.value.state === "healed";
  const verifiedOk =
    verifyState?.ok === true && verifyState.value.state === "ok";

  const isListed = listed && lmxId !== null;

  return (
    <section
      aria-label="PinballMap listing"
      className="space-y-2 rounded-md border border-outline bg-surface p-3"
    >
      <div className="flex items-center gap-2">
        <MapPin aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">
          PinballMap listing
        </h3>
      </div>

      {isListed && !verifiedStale ? (
        // State 3 — listed + linked (steady state).
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">
              <CheckCircle2 aria-hidden="true" />
              Listed
            </Badge>
            <PbmDeepLink href={pinballmapUrl}>Open on PinballMap</PbmDeepLink>
          </div>
          {canLink ? (
            <form action={verifyAction}>
              <input type="hidden" name="machineId" value={machineId} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                loading={verifyPending}
              >
                Verify link
              </Button>
            </form>
          ) : null}
          {verifiedOk ? (
            <p className="text-xs text-muted-foreground">
              Link confirmed against PinballMap&apos;s current lineup.
            </p>
          ) : null}
          {verifiedHealed ? (
            <p className="text-xs text-success">
              Link reconnected — PinballMap had re-issued this entry.
            </p>
          ) : null}
        </div>
      ) : verifiedStale ? (
        // State 4 — link broken (a Verify came back stale).
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="destructive">
              <AlertTriangle aria-hidden="true" />
              Link may be broken
            </Badge>
            <PbmDeepLink href={pinballmapUrl}>Open on PinballMap</PbmDeepLink>
          </div>
          <p className="text-xs text-muted-foreground">
            This machine is no longer on PinballMap&apos;s lineup for our
            location. If it was re-added, reconnect to restore the link.
          </p>
          {canLink ? (
            <form action={verifyAction}>
              <input type="hidden" name="machineId" value={machineId} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                loading={verifyPending}
              >
                Reconnect
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        // States 1 & 2 — not listed / on-PBM-but-unlinked. One lookup branches.
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Not listed</Badge>
            <PbmDeepLink href={pinballmapUrl}>Open on PinballMap</PbmDeepLink>
          </div>
          {canLink ? (
            <form action={linkAction}>
              <input type="hidden" name="machineId" value={machineId} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                loading={linkPending}
              >
                <MapPin aria-hidden="true" className="size-4" />
                Connect to PinballMap
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              Not listed on PinballMap.
            </p>
          )}
          {linkAbsent ? (
            <p className="text-xs text-muted-foreground" role="status">
              This machine isn&apos;t on PinballMap&apos;s lineup for our
              location yet. Listing it from PinPoint is coming soon — for now,
              add it on PinballMap.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
