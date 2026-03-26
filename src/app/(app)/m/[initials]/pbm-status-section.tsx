"use client";

import type React from "react";
import { useTransition } from "react";
import { MapPin, Plus, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  addToPinballMapAction,
  removeFromPinballMapAction,
  unlinkPbmMachineAction,
} from "~/app/(app)/m/pinball-map-actions";
import {
  isOnTheFloor,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

interface PbmStatusSectionProps {
  machineId: string;
  presenceStatus: MachinePresenceStatus;
  pbmMachineId: number | null;
  pbmMachineName: string | null;
  pbmLocationMachineXrefId: number | null;
}

export function PbmStatusSection({
  machineId,
  presenceStatus,
  pbmMachineId,
  pbmMachineName,
  pbmLocationMachineXrefId,
}: PbmStatusSectionProps): React.JSX.Element {
  const [isAdding, startAdding] = useTransition();
  const [isRemoving, startRemoving] = useTransition();
  const [isUnlinking, startUnlinking] = useTransition();

  const isOnPbm = pbmLocationMachineXrefId !== null;
  const isLinked = pbmMachineId !== null;
  const onFloor = isOnTheFloor(presenceStatus);

  const handleAddToPbm = (): void => {
    startAdding(async () => {
      const result = await addToPinballMapAction(machineId);
      if (result.ok) {
        toast.success("Added to Pinball Map");
        // Suggest presence update if not on floor
        if (!onFloor) {
          toast("Machine added to Pinball Map", {
            description: "Update status to On the Floor?",
            action: {
              label: "Update Status",
              onClick: () => {
                // This would require a form submission - for now just inform
                toast.info(
                  "Update the machine's availability in the edit dialog."
                );
              },
            },
          });
        }
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleRemoveFromPbm = (): void => {
    startRemoving(async () => {
      const result = await removeFromPinballMapAction(machineId);
      if (result.ok) {
        toast.success("Removed from Pinball Map");
        // Suggest presence update if on floor
        if (onFloor) {
          toast("Machine removed from Pinball Map", {
            description: "Update status to Off the Floor?",
            action: {
              label: "Update Status",
              onClick: () => {
                toast.info(
                  "Update the machine's availability in the edit dialog."
                );
              },
            },
          });
        }
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleUnlink = (): void => {
    startUnlinking(async () => {
      const result = await unlinkPbmMachineAction(machineId);
      if (result.ok) {
        toast.success("Unlinked from Pinball Map");
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="rounded-lg border border-outline/20 bg-surface-container p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-on-surface">Pinball Map</h3>
      </div>

      {!isLinked && (
        <p className="text-sm text-on-surface-variant">
          Not linked to a Pinball Map game model. Use the edit dialog to link
          this machine.
        </p>
      )}

      {isLinked && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-on-surface">{pbmMachineName}</span>
            {isOnPbm ? (
              <Badge
                variant="default"
                className="bg-green-600/20 text-green-400 border-green-600/30"
              >
                Listed
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-on-surface-variant">
                Not Listed
              </Badge>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {!isOnPbm && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddToPbm}
                disabled={isAdding || isRemoving || isUnlinking}
                className="text-xs"
              >
                <Plus className="mr-1 size-3" />
                {isAdding ? "Adding..." : "Add to Pinball Map"}
              </Button>
            )}

            {isOnPbm && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveFromPbm}
                disabled={isAdding || isRemoving || isUnlinking}
                className="text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 size-3" />
                {isRemoving ? "Removing..." : "Remove from Pinball Map"}
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              disabled={isAdding || isRemoving || isUnlinking}
              className="text-xs text-on-surface-variant"
            >
              <Unlink className="mr-1 size-3" />
              {isUnlinking ? "Unlinking..." : "Unlink"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
