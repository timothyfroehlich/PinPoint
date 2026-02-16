"use client";

import type React from "react";
import { InlineEditableField } from "~/components/inline-editable-field";
import {
  updateMachineDescription,
  updateMachineTournamentNotes,
  updateMachineOwnerRequirements,
  updateMachineOwnerNotes,
} from "~/app/(app)/m/actions";

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
    <div className="space-y-4">
      <InlineEditableField
        label="Description"
        value={description}
        onSave={updateMachineDescription}
        machineId={machineId}
        canEdit={canEditGeneral}
        placeholder="Add a description for this machine..."
        testId="machine-description"
      />

      <InlineEditableField
        label="Tournament Notes"
        value={tournamentNotes}
        onSave={updateMachineTournamentNotes}
        machineId={machineId}
        canEdit={canEditGeneral}
        placeholder="Add tournament notes..."
        testId="machine-tournament-notes"
      />

      {canViewOwnerRequirements && (
        <InlineEditableField
          label="Owner's Requirements"
          value={ownerRequirements}
          onSave={updateMachineOwnerRequirements}
          machineId={machineId}
          canEdit={canEditGeneral}
          placeholder="Add owner's requirements..."
          testId="machine-owner-requirements"
        />
      )}

      {canViewOwnerNotes && (
        <InlineEditableField
          label="Owner's Notes"
          value={ownerNotes}
          onSave={updateMachineOwnerNotes}
          machineId={machineId}
          canEdit={canEditOwnerNotes}
          placeholder="Add private notes (only visible to you)..."
          testId="machine-owner-notes"
        />
      )}
    </div>
  );
}
