"use client";

import type React from "react";
import { useActionState, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  updateMachineAction,
  type UpdateMachineResult,
} from "~/app/(app)/m/actions";
import { PinballMapLinkField } from "~/components/machines/PinballMapLinkField";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

export interface MachineDetailsFormProps {
  machineId: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
  description: ProseMirrorDoc | null;
  /** Viewer may set/change the PinballMap catalog link. */
  canLink: boolean;
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  pinballmapExcludedReason: string | null;
  pinballmapTitleName: string | null;
}

/**
 * Details section of the machine edit page (PP-o355.19).
 *
 * The section owns its own save: everything inside this form is written by one
 * `updateMachineAction` submit, and nothing outside it rides along. Ownership
 * deliberately does NOT live here — it moved to the Danger zone, which submits
 * its own form. Because this form carries no `ownerId` field, the action leaves
 * the owner columns untouched.
 *
 * The PinballMap catalog picker renders here rather than in the PinballMap
 * section because it is genuinely part of this save today — it submits with
 * these fields. PP-o355.21 moves it into that section with its own Save title
 * button; until then, putting it under a heading that implies otherwise would
 * misrepresent the save model.
 */
export function MachineDetailsForm({
  machineId,
  name,
  presenceStatus,
  description,
  canLink,
  pinballmapMachineId,
  pinballmapExcluded,
  pinballmapExcludedReason,
  pinballmapTitleName,
}: MachineDetailsFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  const [isDirty, setIsDirty] = useState(false);
  // The RichTextEditor is uncontrolled after mount (content is an initial
  // prop), so its doc is mirrored here to serialize into the hidden field.
  const [descriptionDoc, setDescriptionDoc] = useState<ProseMirrorDoc | null>(
    description
  );
  // Cancel remounts the subtree by changing the key — a native form reset
  // cannot restore a contenteditable widget.
  const [resetKey, setResetKey] = useState(0);

  // A successful save makes the submitted values the new baseline.
  useEffect(() => {
    if (state?.ok) {
      setIsDirty(false);
    }
  }, [state]);

  const handleCancel = (): void => {
    setDescriptionDoc(description);
    setResetKey((k) => k + 1);
    setIsDirty(false);
  };

  return (
    <form
      key={resetKey}
      action={formAction}
      // Any native input event marks the section dirty. Radix Select changes
      // do not bubble `input`, so Availability flags dirtiness explicitly.
      onInput={() => setIsDirty(true)}
      className="space-y-6"
      data-testid="machine-details-form"
    >
      <input type="hidden" name="id" value={machineId} />

      {state && !state.ok && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="edit-name" className="text-foreground">
          Machine Name <span aria-hidden="true">*</span>
        </Label>
        <Input
          id="edit-name"
          name="name"
          type="text"
          required
          defaultValue={name}
          placeholder="e.g., Medieval Madness"
          enterKeyHint="next"
          className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {canLink && (
        <PinballMapLinkField
          defaultMachineId={pinballmapMachineId}
          defaultName={pinballmapTitleName}
          defaultExcluded={pinballmapExcluded}
          defaultExcludedReason={pinballmapExcludedReason}
        />
      )}

      <div className="space-y-2">
        {/* No htmlFor: RichTextEditor is a contenteditable widget with no
            focusable `id`. Its accessible name comes from `ariaLabel`. */}
        <Label className="text-foreground">Description</Label>
        <RichTextEditor
          content={description}
          onChange={(doc) => {
            setDescriptionDoc(doc);
            setIsDirty(true);
          }}
          mentionsEnabled={false}
          placeholder="Add a description for this machine..."
          ariaLabel="Machine description"
          compact={false}
          className="min-h-[120px]"
        />
        <input
          type="hidden"
          name="description"
          value={descriptionDoc ? JSON.stringify(descriptionDoc) : ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-presence" className="text-foreground">
          Availability
        </Label>
        <Select
          name="presenceStatus"
          defaultValue={presenceStatus}
          onValueChange={() => setIsDirty(true)}
        >
          <SelectTrigger
            id="edit-presence"
            className="border-outline bg-surface text-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VALID_MACHINE_PRESENCE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {getMachinePresenceLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-3">
        <span
          className={
            isDirty
              ? "mr-auto text-sm text-warning"
              : "mr-auto text-sm text-muted-foreground"
          }
          data-testid="details-dirty-note"
        >
          {isDirty
            ? "Unsaved changes"
            : state?.ok
              ? "Saved"
              : "No unsaved changes"}
        </span>
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-primary text-on-primary hover:bg-primary/90"
          loading={isPending}
        >
          Save details
        </Button>
      </div>
    </form>
  );
}
