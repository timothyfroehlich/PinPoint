import type React from "react";

import { PersonHoverCard } from "~/components/people/PersonHoverCard";
import { formatDate } from "~/lib/dates";

interface InfoRailProps {
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  invitedOwner: { name: string } | null;
  addedAt: Date;
  /**
   * Machine description, rendered inside the Details card above the owner row.
   * Pass `null` to omit the Description section entirely (empty + non-editable).
   */
  descriptionSlot?: React.ReactNode;
  /** Edit-machine control (dialog trigger or denied tooltip), shown in the owner card footer. */
  editSlot?: React.ReactNode;
  /**
   * PinballMap card (PP-o355.3). Rendered as-is when provided; when omitted, the
   * PinballMap slot renders nothing.
   */
  pinballmapSlot?: React.ReactNode;
}

const CARD = "rounded-xl border border-outline-variant bg-card p-4";
const PLACEHOLDER_CARD =
  "rounded-xl border border-dashed border-secondary/50 bg-card p-4";
const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const COMING_SOON = "text-sm text-muted-foreground";

/**
 * InfoRail — the Info tab's reference cluster: the Machine card (owner +
 * description + Edit), then Tags and PinballMap. Renders as the desktop right
 * rail and folds inline on mobile (the caller controls placement + gap; this
 * returns the cards as a fragment).
 *
 * Tags is still a reserved placeholder (Collections fills it later). PinballMap
 * renders the `pinballmapSlot` card when the caller provides one (PP-o355.3),
 * and nothing when it doesn't.
 */
export function InfoRail({
  owner,
  invitedOwner,
  addedAt,
  descriptionSlot,
  editSlot,
  pinballmapSlot,
}: InfoRailProps): React.JSX.Element {
  return (
    <>
      {/* Details — reading order: the machine description (primary content;
          read-only, edited via the Edit Machine dialog), then the owner in a
          distinct panel with an explicit role badge (name only, never email
          per CORE-SEC-007), then the Edit-machine control. */}
      <div className={CARD} data-testid="machine-owner-card">
        <p className={`mb-3 ${LABEL}`}>Details</p>

        {descriptionSlot ? (
          <div className="text-sm text-muted-foreground">{descriptionSlot}</div>
        ) : null}

        {/* Owner — under a soft divider from the description above. A plain
            "Owner" label leads the name (link; name only, never email per
            CORE-SEC-007), with the added date on the line below. */}
        <div
          data-testid="owner-block"
          className={
            descriptionSlot
              ? "mt-4 border-t border-outline-variant pt-4"
              : undefined
          }
        >
          {owner || invitedOwner ? (
            <div>
              <p className="text-sm">
                <span className="font-semibold text-muted-foreground">
                  Owner
                </span>{" "}
                {owner ? (
                  <PersonHoverCard
                    userId={owner.id}
                    displayName={owner.name}
                    className="font-semibold text-primary hover:underline"
                  />
                ) : (
                  <>
                    <span className="font-semibold text-foreground">
                      {invitedOwner?.name}
                    </span>
                    <span className="text-muted-foreground"> (invited)</span>
                  </>
                )}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Added {formatDate(addedAt)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No owner assigned</p>
          )}
        </div>

        {editSlot ? <div className="mt-4">{editSlot}</div> : null}
      </div>

      {/* Tags — reserved slot for the future Collections feature. */}
      <div className={PLACEHOLDER_CARD} data-testid="machine-tags-placeholder">
        <p className={`mb-2 ${LABEL}`}>Tags</p>
        <p className={COMING_SOON}>Coming soon!</p>
      </div>

      {/* PinballMap — the PP-o355.3 card fills this slot only when the machine is
          listed on PinballMap; otherwise the caller passes nothing and no card
          renders here. */}
      {pinballmapSlot}
    </>
  );
}
