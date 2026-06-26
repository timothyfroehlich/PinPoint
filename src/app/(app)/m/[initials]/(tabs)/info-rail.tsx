import type React from "react";
import { Lock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { PersonHoverCard } from "~/components/people/PersonHoverCard";
import { formatDate } from "~/lib/dates";

interface InfoRailProps {
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  invitedOwner: { name: string } | null;
  addedAt: Date;
}

const CARD = "rounded-xl border border-outline-variant bg-card p-4";
const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const FUTURE_BADGE =
  "rounded border border-dashed border-secondary px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-secondary";

function ownerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * InfoRail — the Info tab's reference cluster: Tags, Owner, PinballMap. Renders
 * as the desktop right rail and folds inline on mobile (the caller controls
 * placement + gap; this returns the three cards as a fragment).
 *
 * Frame-first: Tags and PinballMap are reserved placeholder slots (Collections
 * and PP-o355.3 respectively fill them later). Only Owner shows live data.
 */
export function InfoRail({
  owner,
  invitedOwner,
  addedAt,
}: InfoRailProps): React.JSX.Element {
  return (
    <>
      {/* Tags — reserved slot for the future Collections feature. The dashed
          border + "Future" badge mark it as not-yet-live. No fabricated tags;
          a small legend explains the public-vs-private model the feature will
          use (PP-5sgt.2 design §3). */}
      <div
        className="rounded-xl border border-dashed border-secondary/50 bg-card p-4"
        data-testid="machine-tags-placeholder"
      >
        <p className={`mb-2 flex items-center gap-2 ${LABEL}`}>
          Tags <span className={FUTURE_BADGE}>Future</span>
        </p>
        <p className="text-pretty text-[11px] leading-snug text-muted-foreground">
          Tagging arrives with Collections.
        </p>
        <ul className="mt-2.5 space-y-1.5 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span>
              <span className="text-primary">Public</span> — visible to everyone
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Lock
              className="size-3 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <span>
              <span className="text-secondary">Private</span> — only you
            </span>
          </li>
        </ul>
      </div>

      {/* Owner — name only, never email (CORE-SEC-007). */}
      <div className={CARD} data-testid="machine-owner-card">
        <p className={`mb-2 ${LABEL}`}>Owner</p>
        {owner || invitedOwner ? (
          <div className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0">
              {owner?.avatarUrl ? (
                <AvatarImage src={owner.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="bg-primary text-xs font-semibold text-on-primary">
                {ownerInitials(owner?.name ?? invitedOwner?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {owner ? (
                <PersonHoverCard
                  userId={owner.id}
                  displayName={owner.name}
                  className="text-sm font-semibold text-primary hover:underline"
                />
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {invitedOwner?.name}
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    (Invited)
                  </span>
                </span>
              )}
              <p className="text-[11px] text-muted-foreground">
                Added {formatDate(addedAt)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No owner assigned</p>
        )}
      </div>

      {/* PinballMap — reserved slot. Real listing status + the public
          "View on PinballMap" deep link arrive with PP-o355.3; until then this
          is an honest placeholder with no fabricated external link. */}
      <div
        className="rounded-xl border border-dashed border-secondary/50 bg-card p-4"
        data-testid="machine-pinballmap-placeholder"
      >
        <p className={`mb-1.5 flex items-center gap-2 ${LABEL}`}>
          <span className="text-secondary">◆</span> PinballMap{" "}
          <span className={FUTURE_BADGE}>Future</span>
        </p>
        <p className="text-pretty text-[11px] leading-snug text-muted-foreground">
          Listing status and a public link to this machine on PinballMap will
          appear here once it&apos;s linked.
        </p>
      </div>
    </>
  );
}
