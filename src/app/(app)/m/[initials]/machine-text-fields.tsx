"use client";

import type React from "react";
import {
  InlineEditableField,
  type InlineEditSaveResult,
} from "~/components/inline-editable-field";
import {
  updateMachineDescription,
  updateMachineOwnerRequirements,
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

interface MachineTextFieldsProps {
  machineId: string;
  description: ProseMirrorDoc | null;
  ownerRequirements: ProseMirrorDoc | null;
  canEditGeneral: boolean;
  canViewOwnerRequirements: boolean;
}

export function MachineTextFields({
  machineId,
  description,
  ownerRequirements,
  canEditGeneral,
  canViewOwnerRequirements,
}: MachineTextFieldsProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <InlineEditableField
        label="Description"
        value={description}
        onSave={wrapAction(updateMachineDescription)}
        machineId={machineId}
        canEdit={canEditGeneral}
        placeholder="Add a description for this machine..."
        testId="machine-description"
      />

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
    </div>
  );
}
