"use client";

import type React from "react";
import { useEffect, useId, useState } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  InsiderConnectedToggle,
  IntentToggle,
} from "~/components/machines/PinballmapListingControl";
import { getPinballMapTitleIcEligibleAction } from "~/app/(app)/m/pinballmap-actions";
import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import {
  INVALID_WHEN_ON,
  type PbmListingIntent,
} from "~/lib/pinballmap/listing-state";
import type { PbmIcIntent } from "~/lib/pinballmap/insider-connected";

export interface NewMachinePinballmapFieldsProps {
  /** The catalog title chosen in Model Details, or null while none is. */
  pinballmapMachineId: number | null;
  /** The form's live Availability — it can block On (pinballmap 6.2). */
  presenceStatus: MachinePresenceStatus;
  /** A tracked location exists; without one there is no lineup to choose. */
  configured: boolean;
  /** From the location's Pinball Map entry; null before the first refresh. */
  locationName: string | null;
  /** The machine-linking capability: intent and Insider Connected (8.1). */
  canSetIntent: boolean;
  /**
   * The push capability AND an operator credential — what the Manage tab's
   * Add button needs (8.2, 4.4). Without both, no add after creating is
   * offered, rather than offered and failing.
   */
  canAddAfterCreate: boolean;
  /**
   * Catalog titles already on the location's lineup. Adding one has nothing
   * to add, so "Add to Pinball Map after creating" is not offered (4.11).
   */
  lineupTitleIds: readonly number[];
  /**
   * Where the intent toggle starts: On when the page was opened from a lineup
   * entry (4.11, pinballmap-lineup 5.4), otherwise Off.
   */
  initialIntent?: PbmListingIntent;
}

/**
 * The New Machine page's Pinball Map choices (pinballmap 4.11), inside
 * Integrations: the lineup intent toggle and, for an eligible title, the
 * Insider Connected toggle, both starting Off (intent starts On when the page
 * was opened from a lineup entry). With intent On, a title not already on the
 * lineup, and a person who can push, "Add to Pinball Map after creating" — ticked by default, and
 * ticking it is the 4.5 confirmation for the add push the create then runs.
 *
 * Only for a catalog title: on Manual Entry the Integrations box shows
 * Pinball Map as unavailable instead, so this does not render.
 *
 * Everything posts through hidden inputs, read by `createMachineAction`,
 * which re-checks every rule here on the server.
 */
export function NewMachinePinballmapFields({
  pinballmapMachineId,
  presenceStatus,
  configured,
  locationName,
  canSetIntent,
  canAddAfterCreate,
  lineupTitleIds,
  initialIntent = "off",
}: NewMachinePinballmapFieldsProps): React.JSX.Element {
  const addId = useId();
  const [intent, setIntent] = useState<PbmListingIntent>(initialIntent);
  // Null is Don't sync: no intent recorded (3.8).
  const [icIntent, setIcIntent] = useState<PbmIcIntent | null>("off");
  const [addAfterCreate, setAddAfterCreate] = useState(true);
  // Eligibility of the chosen title, keyed by id so a stale answer for a
  // previous pick never shows the switch for the current one.
  const [icEligibility, setIcEligibility] = useState<{
    id: number;
    eligible: boolean;
  } | null>(null);

  useEffect(() => {
    if (pinballmapMachineId === null) return;
    let active = true;
    void getPinballMapTitleIcEligibleAction(pinballmapMachineId)
      .then((eligible) => {
        if (active) setIcEligibility({ id: pinballmapMachineId, eligible });
      })
      .catch((error: unknown) => {
        // Non-fatal: the switch stays hidden and nothing is recorded, which
        // is the same as an ineligible title.
        console.error("Failed to read Insider Connected eligibility", error);
      });
    return () => {
      active = false;
    };
  }, [pinballmapMachineId]);

  const titleChosen = pinballmapMachineId !== null;
  const icEligible =
    titleChosen &&
    icEligibility?.id === pinballmapMachineId &&
    icEligibility.eligible;
  const blockedReason = INVALID_WHEN_ON.includes(presenceStatus)
    ? `Blocked by Availability: ${getMachinePresenceLabel(presenceStatus)}`
    : null;
  // Choosing a blocking Availability after On reads as Off rather than
  // posting a create the server will refuse. Nothing is stored yet, so this
  // is the form following its own inputs, not an automatic intent change.
  const effectiveIntent: PbmListingIntent =
    intent === "on" && blockedReason !== null ? "off" : intent;
  const alreadyOnLineup =
    pinballmapMachineId !== null &&
    lineupTitleIds.includes(pinballmapMachineId);
  const offerAdd =
    effectiveIntent === "on" && canAddAfterCreate && !alreadyOnLineup;

  const title =
    locationName !== null ? `Pinball Map — ${locationName}` : "Pinball Map";

  return (
    <div className="flex flex-col gap-3" data-testid="new-machine-pbm">
      <span className="text-sm font-semibold text-foreground">{title}</span>

      {!configured ? (
        <span className="text-sm text-muted-foreground">
          No tracked location
        </span>
      ) : !titleChosen ? (
        <span className="text-sm text-muted-foreground">
          Lineup choice needs a model
        </span>
      ) : (
        <>
          {canSetIntent ? (
            <input
              type="hidden"
              name="pinballmapIntent"
              value={effectiveIntent}
            />
          ) : null}
          {/* Don't sync posts nothing, so no intent is stored (3.8). */}
          {canSetIntent && icEligible && icIntent !== null ? (
            <input type="hidden" name="pinballmapIcIntent" value={icIntent} />
          ) : null}
          {offerAdd && addAfterCreate ? (
            <input type="hidden" name="pbmAddAfterCreate" value="1" />
          ) : null}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <IntentToggle
                value={effectiveIntent}
                blockedReason={blockedReason}
                readOnly={!canSetIntent}
                pending={false}
                onChange={setIntent}
              />
            </div>
            {icEligible ? (
              <div data-testid="new-machine-pbm-ic">
                {/* A new machine has no entry yet, so there is no Pinball Map
                    value to state or differ from. */}
                <InsiderConnectedToggle
                  value={icIntent}
                  pinballMap={null}
                  differs={false}
                  readOnly={!canSetIntent}
                  pending={false}
                  onChange={setIcIntent}
                />
              </div>
            ) : null}
          </div>

          {offerAdd ? (
            <div className="flex items-center gap-2.5">
              <Checkbox
                id={addId}
                checked={addAfterCreate}
                onCheckedChange={(checked) => {
                  setAddAfterCreate(checked === true);
                }}
                data-testid="new-machine-pbm-add"
              />
              <Label htmlFor={addId} className="text-sm font-normal">
                Add to Pinball Map after creating
              </Label>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
