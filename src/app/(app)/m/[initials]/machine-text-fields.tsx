"use client";

import type React from "react";
import { FileText, Lock, Shield, Trophy } from "lucide-react";
import {
  InlineEditableField,
  type InlineEditSaveResult,
} from "~/components/inline-editable-field";
import { Separator } from "~/components/ui/separator";
import {
  updateMachineDescription,
  updateMachineTournamentNotes,
  updateMachineOwnerRequirements,
  updateMachineOwnerNotes,
  type UpdateMachineFieldResult,
} from "~/app/(app)/m/actions";

/** Adapt the Result<T, C> discriminated union to the simpler { ok, message } shape */
function adaptResult(result: UpdateMachineFieldResult): InlineEditSaveResult {
  if (result.ok) return { ok: true };
  return { ok: false, message: result.message };
}

function wrapAction(
  action: (id: string, value: string) => Promise<UpdateMachineFieldResult>
): (id: string, value: string) => Promise<InlineEditSaveResult> {
  return async (id, value) => adaptResult(await action(id, value));
}

interface MachineTextFieldsProps {
  machineId: string;
  description: string | null;
  tournamentNotes: string | null;
  ownerRequirements: string | null;
  ownerNotes: string | null;
  canEditGeneral: boolean;
  canEditOwnerNotes: boolean;
  canViewOwnerRequirements: boolean;
  canViewOwnerNotes: boolean;
}

export function MachineTextFields({
  machineId,
  description,
  tournamentNotes,
  ownerRequirements,
  ownerNotes,
  canEditGeneral,
  canEditOwnerNotes,
  canViewOwnerRequirements,
  canViewOwnerNotes,
}: MachineTextFieldsProps): React.JSX.Element {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/50 pb-2">
        Notes &amp; Details
      </h3>

      <InlineEditableField
        icon={FileText}
        label="Description"
        value={description}
        onSave={wrapAction(updateMachineDescription)}
        machineId={machineId}
        canEdit={canEditGeneral}
        placeholder="Add a description for this machine..."
        testId="machine-description"
      />

      <InlineEditableField
        icon={Trophy}
        label="Tournament Notes"
        value={tournamentNotes}
        onSave={wrapAction(updateMachineTournamentNotes)}
        machineId={machineId}
        canEdit={canEditGeneral}
        placeholder="Add tournament notes..."
        testId="machine-tournament-notes"
      />

      {(canViewOwnerRequirements || canViewOwnerNotes) && (
        <Separator className="bg-outline-variant/50" />
      )}

      {canViewOwnerRequirements && (
        <InlineEditableField
          icon={Shield}
          label="Owner's Requirements"
          value={ownerRequirements}
          onSave={wrapAction(updateMachineOwnerRequirements)}
          machineId={machineId}
          canEdit={canEditGeneral}
          placeholder="Add owner's requirements..."
          testId="machine-owner-requirements"
        />
      )}

      {canViewOwnerNotes && (
        <InlineEditableField
          icon={Lock}
          label="Owner's Notes (Private)"
          value={ownerNotes}
          onSave={wrapAction(updateMachineOwnerNotes)}
          machineId={machineId}
          canEdit={canEditOwnerNotes}
          placeholder="Add private notes (only visible to you)..."
          testId="machine-owner-notes"
          variant="private"
        />
      )}
    </div>
  );
}
