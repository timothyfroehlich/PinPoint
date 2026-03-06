import type React from "react";
import { ExternalLink } from "lucide-react";
import { OwnerBadge } from "~/components/issues/OwnerBadge";

interface MachineInfoDisplayProps {
  machine: {
    name: string;
    initials: string;
    ownerId: string | null;
    invitedOwnerId: string | null;
    opdbId?: string | null;
    opdbTitle?: string | null;
    opdbManufacturer?: string | null;
    opdbYear?: number | null;
    opdbImageUrl?: string | null;
    opdbMachineType?: string | null;
    createdAt: Date;
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
}: MachineInfoDisplayProps): React.JSX.Element {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col gap-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 border-b border-outline-variant/50 pb-2 flex items-center justify-between">
        Machine Details
      </h3>

      <div className="flex flex-col gap-3">
        {machine.opdbId && (
          <div className="flex justify-between items-end gap-4">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant shrink-0">
              Official Model
            </span>
            <a
              href={`https://opdb.org/m/${machine.opdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-on-surface hover:text-primary transition flex items-center gap-1.5 group text-right w-fit"
            >
              <span className="truncate">
                {machine.opdbTitle ?? machine.name}
              </span>
              <ExternalLink className="size-3 shrink-0 text-on-surface-variant group-hover:text-primary transition-colors" />
            </a>
          </div>
        )}

        {machine.opdbManufacturer && (
          <div className="flex justify-between items-end gap-4">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant shrink-0">
              Manufacturer
            </span>
            <span className="text-sm font-medium text-on-surface text-right">
              {machine.opdbManufacturer}
            </span>
          </div>
        )}

        {machine.opdbYear && (
          <div className="flex justify-between items-end gap-4">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant shrink-0">
              Year / Era
            </span>
            <span className="text-sm font-medium text-on-surface tracking-widest text-right">
              {machine.opdbYear}{" "}
              {machine.opdbMachineType && (
                <>
                  <span className="text-on-surface-variant font-normal tracking-normal mx-1">
                    |
                  </span>{" "}
                  {machine.opdbMachineType}
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {machine.opdbId && (
        <div className="w-full h-px bg-outline-variant/50 my-1"></div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-end gap-4">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant shrink-0">
            Identifier
          </span>
          <span className="text-sm font-medium text-on-surface text-right">
            {machine.initials}
          </span>
        </div>

        <div className="flex justify-between items-end gap-4">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant shrink-0">
            Owner
          </span>
          <div className="flex items-center gap-2 justify-end">
            {machine.owner || machine.invitedOwner ? (
              <>
                <OwnerBadge size="sm" />
                <span className="text-sm font-medium text-on-surface line-clamp-1">
                  {machine.owner?.name ?? machine.invitedOwner?.name}
                  {machine.invitedOwner && !machine.owner && (
                    <span className="text-[10px] uppercase tracking-wider text-on-surface-variant ml-1">
                      (Invited)
                    </span>
                  )}
                </span>
              </>
            ) : (
              <span className="text-sm text-on-surface-variant">
                Unassigned
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-between items-end gap-4">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant shrink-0">
            Added Date
          </span>
          <span className="text-sm font-medium text-on-surface-variant text-right">
            {machine.createdAt.toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
