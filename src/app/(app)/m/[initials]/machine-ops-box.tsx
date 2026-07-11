import type React from "react";

import { MachineStatusBadge } from "~/components/machines/MachineStatusBadge";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
import { MachinePresenceSelect } from "~/app/(app)/m/[initials]/machine-presence-select";
import { MachineTextFields } from "~/app/(app)/m/[initials]/machine-text-fields";
import type { MachineStatus } from "~/lib/machines/status";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

interface MachineOpsBoxProps {
  machineId: string;
  machineStatus: MachineStatus;
  presenceStatus: MachinePresenceStatus;
  /** Owner/tech/admin may change presence; others see it read-only. */
  canEditPresence: boolean;
  /** The single Watch toggle — same control for everyone (design §7, PP-71ye). */
  watchButton?: React.ReactNode;
  /** Owner-private requirements, relocated here from the Info tab (design §4). */
  ownerRequirements: ProseMirrorDoc | null;
  canViewOwnerRequirements: boolean;
  canEditGeneral: boolean;
}

/**
 * Machine box — the Service tab's right-rail ops card (design §4). Read-only
 * derived **Status**, a manual **Availability** select (owner/tech/admin), the
 * single **Watch** toggle, and the owner-private **Owner's Requirements** field
 * relocated off the Info tab.
 */
export function MachineOpsBox({
  machineId,
  machineStatus,
  presenceStatus,
  canEditPresence,
  watchButton,
  ownerRequirements,
  canViewOwnerRequirements,
  canEditGeneral,
}: MachineOpsBoxProps): React.JSX.Element {
  return (
    <section
      className="rounded-xl border border-outline-variant bg-card p-4"
      data-testid="machine-ops-box"
      aria-labelledby="machine-ops-heading"
    >
      <h2 id="machine-ops-heading" className={`mb-3 ${LABEL}`}>
        Machine
      </h2>

      <div className="space-y-4">
        {/* Status — derived from open issues, never manually set. */}
        <div>
          <p className={`mb-1 ${LABEL}`}>Status</p>
          <MachineStatusBadge status={machineStatus} size="xs" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Derived from open issues — not set by hand.
          </p>
        </div>

        {/* Availability — the one manual control. */}
        <div>
          <p className={`mb-1 ${LABEL}`}>Availability</p>
          {canEditPresence ? (
            <MachinePresenceSelect
              machineId={machineId}
              value={presenceStatus}
            />
          ) : (
            <MachinePresenceBadge status={presenceStatus} size="sm" />
          )}
        </div>

        {/* Watch — one toggle for everyone, owners included. */}
        {watchButton ? (
          <div>
            {watchButton}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Watching sends you updates — it isn&apos;t the same as owning.
            </p>
          </div>
        ) : null}

        {/* Owner&apos;s Requirements — owner-private, relocated from the Info tab.
            Description stays on Info, so it is never rendered here. */}
        {canViewOwnerRequirements ? (
          <div className="border-t border-outline-variant pt-4">
            <MachineTextFields
              machineId={machineId}
              description={null}
              ownerRequirements={ownerRequirements}
              canEditGeneral={canEditGeneral}
              canViewOwnerRequirements={canViewOwnerRequirements}
              showDescription={false}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
