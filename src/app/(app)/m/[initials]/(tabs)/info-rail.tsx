import type React from "react";
import { TriangleAlert } from "lucide-react";

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
   * The game's model identity — normally the Pinball Map catalog title (e.g.
   * "Godzilla (Premium)"), or a hand-entered name for a machine their catalog
   * doesn't carry. `null` renders "Not specified".
   *
   * Model is deliberately NOT framed as a Pinball Map concept. It is generic
   * model information that today happens to come from their catalog, and under
   * PP-3bbr it is hand-enterable. That framing also matters for CORE-PBM-001: a
   * game's title/manufacturer/year is catalog data, identical for every copy of
   * that game anywhere, so it does not trip the licence's "displays data for a
   * specific location" clause. The row below it does.
   */
  modelName: string | null;
  /**
   * The machine's standing on Pinball Map, rendered as one unlabelled line
   * under Model.
   *
   * The line is ALWAYS a link to our location's listing, in both the listed and
   * the unlisted state. That is not decoration: listed-vs-not is a claim about
   * APC's lineup derived from Pinball Map's location payload, which CORE-PBM-001
   * says must carry a link to that location's listing — and with no row label,
   * this line is the card's only attribution anchor.
   */
  pinballmap: {
    /** `pinballmapLocationUrl()` — the by_location_id form, never hand-written. */
    locationUrl: string;
    listed: boolean;
    /**
     * Show the "Config issue" warning. TWO different disagreements raise it:
     * an entry this machine left live on the public map under a title it no
     * longer uses (PP-l81u), and an actionable desync between our records and
     * the stored snapshot (`isActionableDesync`).
     *
     * That breadth is why the label is generic. "Previous listing" would be a
     * lie for the desync case and "Needs cleanup" implies a chore when the
     * answer may be to accept what the map says instead.
     *
     * Gated on `machines.pinballmap.diagnose` by the caller — read-only here.
     */
    configIssue: boolean;
    /** Where the warning sends the reader to resolve it (the Manage tab). */
    manageHref: string;
  };
}

const CARD = "rounded-xl border border-outline-variant bg-card p-4";
const PLACEHOLDER_CARD =
  "rounded-xl border border-dashed border-secondary/50 bg-card p-4";
const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const COMING_SOON = "text-sm text-muted-foreground";

/**
 * InfoRail — the Info tab's reference cluster: the Details card (description,
 * Model, Pinball Map standing, owner, Edit), then Tags. Renders as the desktop
 * right rail and folds inline on mobile (the caller controls placement + gap;
 * this returns the cards as a fragment).
 *
 * Tags is still a reserved placeholder (Collections fills it later).
 *
 * PP-o355.21 removed the standalone Pinball Map card that PP-o355.3 introduced
 * and PP-l81u last extended. A whole card for two facts hid them: a reader
 * scanning a machine's identity had to look in a second box to learn what game
 * it is and whether the public map knows about it. Both are now ordinary rows
 * in Details beside Owner, which is what they always were.
 */
export function InfoRail({
  owner,
  invitedOwner,
  addedAt,
  descriptionSlot,
  editSlot,
  modelName,
  pinballmap,
}: InfoRailProps): React.JSX.Element {
  return (
    <>
      {/* Details — reading order: the machine description (primary content;
          read-only, edited on the Manage tab), then the machine's identity
          (Model + its Pinball Map standing), then the owner in a distinct panel
          with an explicit role badge (name only, never email per CORE-SEC-007),
          then the Edit-machine control.

          `@container` is here so the Config-issue warning can measure THIS card
          rather than the viewport (CORE-RESP-002). The card is 320px in the
          desktop rail but full-width when the rail folds inline on mobile, so a
          viewport breakpoint would answer the wrong question. */}
      <div className={`@container ${CARD}`} data-testid="machine-owner-card">
        <p className={`mb-3 ${LABEL}`}>Details</p>

        {descriptionSlot ? (
          <div className="text-sm text-muted-foreground">{descriptionSlot}</div>
        ) : null}

        {/* Model + Pinball Map — the machine's identity, under a soft divider
            from the description. Model is labelled; the Pinball Map line is
            not, because a "Pinball Map" key beside a "View on Pinball Map"
            value says the same words twice. */}
        <div
          data-testid="machine-model-block"
          className={
            descriptionSlot
              ? "mt-4 border-t border-outline-variant pt-4"
              : undefined
          }
        >
          <p className="text-sm">
            <span className="font-semibold text-muted-foreground">Model</span>{" "}
            {modelName === null ? (
              <span className="text-muted-foreground">Not specified</span>
            ) : (
              <span className="text-foreground">{modelName}</span>
            )}
          </p>

          <p className="mt-1 flex items-baseline gap-2 text-sm">
            <a
              href={pinballmap.locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              data-testid="machine-pinballmap-line"
            >
              {pinballmap.listed
                ? "View on Pinball Map"
                : "Not listed on Pinball Map"}
            </a>

            {/* One line or nothing. Below the container width where this fits,
                it is hidden outright rather than allowed to wrap (Tim,
                2026-08-12: "either it fits on the same line or we just don't
                have it"). 20rem is the desktop rail's own width, where
                "Not listed on Pinball Map ⚠ Config issue" still fits; the rail
                folding inline on mobile is wider than that, so in practice only
                very narrow phones lose it. Dropping it costs a hint, not the
                information — the Manage tab states the same thing in full.

                `text-warning` (#eab308) is ~9:1 on `bg-card` (#18151b), well
                clear of AA, unlike the destructive red that needed its own
                `-text` token (see globals.css). */}
            {pinballmap.configIssue ? (
              <a
                href={pinballmap.manageHref}
                data-testid="machine-pinballmap-config-issue"
                className="ml-auto hidden shrink-0 items-baseline gap-1 whitespace-nowrap text-warning hover:underline @[20rem]:inline-flex"
              >
                <TriangleAlert
                  className="size-3.5 self-center"
                  aria-hidden="true"
                />
                Config issue
              </a>
            ) : null}
          </p>
        </div>

        {/* Owner — under a soft divider from the Model block above, which always
            renders, so the divider is no longer conditional on a description
            being present. A plain "Owner" label leads the name (link; name
            only, never email per CORE-SEC-007), with the added date below. */}
        <div
          data-testid="owner-block"
          className="mt-4 border-t border-outline-variant pt-4"
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
    </>
  );
}
