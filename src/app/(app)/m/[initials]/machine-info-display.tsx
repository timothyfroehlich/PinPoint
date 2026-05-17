import type React from "react";
import { Calendar } from "lucide-react";
import { EditButtonWithTooltip } from "./edit-button-tooltip";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
import { formatDate } from "~/lib/dates";
import type { MachinePresenceStatus } from "~/lib/machines/presence";

interface MachineInfoDisplayProps {
  machine: {
    name: string;
    initials: string;
    createdAt: Date;
    presenceStatus: MachinePresenceStatus;
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
      {/* Name + Initials removed — both are in the persistent header. */}

      {/* Owner */}
      <div className="space-y-1" data-testid="owner-display">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Machine Owner
        </p>
        {machine.owner || machine.invitedOwner ? (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {machine.owner?.name ?? machine.invitedOwner?.name}
            </p>
            {machine.invitedOwner && !machine.owner && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                (Invited)
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No owner assigned</p>
        )}
      </div>

      {/* Added Date */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Added Date
        </p>
        <div className="flex items-center gap-1.5 text-foreground">
          <Calendar className="size-3 text-muted-foreground" />
          <p className="text-sm font-medium">{formatDate(machine.createdAt)}</p>
        </div>
      </div>

      {/* Availability */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Availability
        </p>
        <MachinePresenceBadge status={machine.presenceStatus} size="sm" />
      </div>

      {/* Disabled-edit tooltip for users who can see but can't edit. The
          enabled EditMachineDialog trigger is rendered by the parent. */}
      {!canEdit && isAuthenticated && editDeniedReason !== null && (
        <EditButtonWithTooltip reason={editDeniedReason} />
      )}
    </div>
  );
}
