import type React from "react";
import { EditButtonWithTooltip } from "./edit-button-tooltip";

interface MachineInfoDisplayProps {
  machine: {
    name: string;
    initials: string;
    ownerId: string | null;
    invitedOwnerId: string | null;
    owner?: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    } | null;
    invitedOwner?: {
      id: string;
      name: string;
    } | null;
  };
  canEdit: boolean;
  editDeniedReason: string | null;
  /** Whether the user is authenticated. When false, edit button is hidden entirely. */
  isAuthenticated: boolean;
}

export function MachineInfoDisplay({
  machine,
  canEdit,
  editDeniedReason,
  isAuthenticated,
}: MachineInfoDisplayProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* Machine Name */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
          Name
        </p>
        <p className="text-sm font-medium text-on-surface">{machine.name}</p>
      </div>

      {/* Initials */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
          Initials
        </p>
        <p className="text-sm font-medium text-on-surface">
          {machine.initials}
        </p>
      </div>

      {/* Owner */}
      <div className="space-y-1" data-testid="owner-display">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
          Machine Owner
        </p>
        {machine.owner || machine.invitedOwner ? (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-on-surface">
              {machine.owner?.name ?? machine.invitedOwner?.name}
            </p>
            {machine.invitedOwner && !machine.owner && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/70">
                (Invited)
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">No owner assigned</p>
        )}
      </div>

      {/* Edit button: hidden for unauth, disabled+tooltip for guest/non-owner member, active for owner/admin */}
      {!canEdit && isAuthenticated && editDeniedReason !== null && (
        <EditButtonWithTooltip reason={editDeniedReason} />
      )}
      {/* When canEdit is true, the EditMachineDialog trigger is rendered by the parent */}
    </div>
  );
}
