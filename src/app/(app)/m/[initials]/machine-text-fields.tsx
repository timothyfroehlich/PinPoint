"use client";

import type React from "react";
import {
  InlineEditableField,
  type InlineEditSaveResult,
} from "~/components/inline-editable-field";
import {
  updateMachineDescription,
  updateMachineOwnerRequirements,
  updateMachineOwnerNotes,
  type UpdateMachineFieldResult,
} from "~/app/(app)/m/actions";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";

/** Adapt the Result<T, C> discriminated union to the simpler { ok, message } shape */
function adaptResult(result: UpdateMachineFieldResult): InlineEditSaveResult {
  if (result.ok) return { ok: true };
  return { ok: false, message: result.message };
}

function wrapAction(
  action: (
    id: string,
    value: ProseMirrorDoc | null
  ) => Promise<UpdateMachineFieldResult>
): (id: string, value: ProseMirrorDoc | null) => Promise<InlineEditSaveResult> {
  return async (id, value) => adaptResult(await action(id, value));
}

interface MachineDescriptionFieldProps {
  machineId: string;
  description: ProseMirrorDoc | null;
  canEdit: boolean;
}

/**
 * MachineDescriptionField — the machine description as standalone prose with
 * NO visible "Description" heading. Lives at the top of the Info-tab main
 * column per the player-landing redesign (the prose is self-evidently the
 * description). Empty + non-editable hides itself (InlineEditableField rule).
 */
export function MachineDescriptionField({
  machineId,
  description,
  canEdit,
}: MachineDescriptionFieldProps): React.JSX.Element | null {
  return (
    <InlineEditableField
      label="Description"
      hideLabel
      value={description}
      onSave={wrapAction(updateMachineDescription)}
      machineId={machineId}
      canEdit={canEdit}
      placeholder="Add a description for this machine..."
      testId="machine-description"
    />
  );
}

interface MachineTextFieldsProps {
  machineId: string;
  description: ProseMirrorDoc | null;
  ownerRequirements: ProseMirrorDoc | null;
  ownerNotes: ProseMirrorDoc | null;
  canEditGeneral: boolean;
  canEditOwnerNotes: boolean;
  canViewOwnerRequirements: boolean;
  canViewOwnerNotes: boolean;
  /**
   * Render the Description field inline. Defaults to true for backward
   * compatibility; the Info tab passes `false` because Description renders
   * separately at the top of the page via {@link MachineDescriptionField}.
   */
  showDescription?: boolean;
}

export function MachineTextFields({
  machineId,
  description,
  ownerRequirements,
  ownerNotes,
  canEditGeneral,
  canEditOwnerNotes,
  canViewOwnerRequirements,
  canViewOwnerNotes,
  showDescription = true,
}: MachineTextFieldsProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {showDescription && (
        <InlineEditableField
          label="Description"
          value={description}
          onSave={wrapAction(updateMachineDescription)}
          machineId={machineId}
          canEdit={canEditGeneral}
          placeholder="Add a description for this machine..."
          testId="machine-description"
        />
      )}

      {canViewOwnerRequirements && (
        <InlineEditableField
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
          label="Owner's Notes"
          value={ownerNotes}
          onSave={wrapAction(updateMachineOwnerNotes)}
          machineId={machineId}
          canEdit={canEditOwnerNotes}
          placeholder="Add private notes (only visible to you)..."
          testId="machine-owner-notes"
        />
      )}
    </div>
  );
}
