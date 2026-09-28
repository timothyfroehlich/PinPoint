"use client";

import type React from "react";
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
  VALID_MACHINE_PRESENCE_STATUSES,
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { FormSectionBox } from "./FormSectionBox";
import { MachineProseField } from "./MachineProseField";
import { SectionAnchor } from "./SectionAnchor";
import { MACHINE_FORM_SECTION_IDS } from "./sections";

/** A rich-text field's starting doc, live doc, and change handler. */
export interface ProseFieldState {
  initial: ProseMirrorDoc | null;
  value: ProseMirrorDoc | null;
  onChange: (doc: ProseMirrorDoc) => void;
}

export interface MachineFormFieldsProps {
  /** Prefix for the name and availability control ids. */
  idPrefix: string;
  /**
   * Machine Name. Pass `value` for a controlled input (New Machine) or
   * `defaultValue` for an uncontrolled one (Manage, which remounts on Cancel).
   */
  name: {
    value?: string;
    defaultValue?: string;
    onChange: (value: string) => void;
  };
  availability: {
    defaultValue: MachinePresenceStatus;
    onValueChange?: (value: MachinePresenceStatus) => void;
  };
  /** Initials and Owner — the New Machine page only (machine-editing 2.2). */
  identityFields?: React.ReactNode;
  /** The Model Details box (`PinballMapLinkField`), or null when not editable. */
  modelDetails: React.ReactNode;
  description: ProseFieldState;
  /** Null hides the field from people not permitted to see it (2.6). */
  ownerRequirements: ProseFieldState | null;
  /** The iScored game picker, or null when iScored is not set up. */
  iscored: React.ReactNode;
  /**
   * The machine is on Manual Entry, so Pinball Map reads as unavailable and
   * says why (3.6).
   */
  pinballmapUnavailable: boolean;
  /** Pinball Map controls under the Integrations fields, if any. */
  pinballmap: React.ReactNode;
}

/**
 * The machine form's fields, in the one order both pages share
 * (machine-editing 2.1, 2.5): machine name and availability; Model Details;
 * Description; Owner's Requirements; Integrations. The Apron card section
 * joins after Integrations in PP-wqit.14.3.
 *
 * Fields only — each page owns its `<form>`, its submission, and its actions,
 * because creating and editing save differently (4.1–4.3). What a page puts in
 * the slots is the difference 2.2–2.3 allow.
 */
export function MachineFormFields({
  idPrefix,
  name,
  availability,
  identityFields,
  modelDetails,
  description,
  ownerRequirements,
  iscored,
  pinballmapUnavailable,
  pinballmap,
}: MachineFormFieldsProps): React.JSX.Element {
  const nameId = `${idPrefix}-name`;
  const availabilityId = `${idPrefix}-presence`;
  const hasIntegrationFields = iscored !== null || pinballmapUnavailable;

  return (
    <div className="@container flex flex-col gap-5">
      {/* Name and Availability pair up on a wide container, and on New Machine
          Initials and Owner fill the second row. The pairing is for space, not
          meaning — tab order runs Name → Availability → Initials → Owner. */}
      <div className="grid gap-4 @xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={nameId} className="text-foreground">
            Machine Name <span aria-hidden="true">*</span>
          </Label>
          <Input
            id={nameId}
            name="name"
            type="text"
            required
            {...(name.value !== undefined
              ? { value: name.value }
              : { defaultValue: name.defaultValue })}
            onChange={(event) => {
              name.onChange(event.target.value);
            }}
            placeholder="e.g., Medieval Madness"
            enterKeyHint="next"
            className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={availabilityId} className="text-foreground">
            Availability
          </Label>
          <Select
            name="presenceStatus"
            defaultValue={availability.defaultValue}
            onValueChange={(value) => {
              // Radix hands back a plain string; narrow it to the vocabulary
              // the options were built from.
              const status = VALID_MACHINE_PRESENCE_STATUSES.find(
                (candidate) => candidate === value
              );
              if (status !== undefined) availability.onValueChange?.(status);
            }}
          >
            <SelectTrigger
              id={availabilityId}
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
        {identityFields}
      </div>

      {modelDetails !== null ? (
        <div>
          <SectionAnchor id={MACHINE_FORM_SECTION_IDS.modelDetails} />
          {modelDetails}
        </div>
      ) : null}

      <MachineProseField
        label="Description"
        name="description"
        ariaLabel="Machine description"
        placeholder="Add a description for this machine..."
        initial={description.initial}
        value={description.value}
        onChange={description.onChange}
        minHeightClass="min-h-[96px]"
      />

      {ownerRequirements !== null ? (
        <MachineProseField
          label="Owner's Requirements"
          name="ownerRequirements"
          ariaLabel="Owner's requirements"
          placeholder="Add owner's requirements..."
          initial={ownerRequirements.initial}
          value={ownerRequirements.value}
          onChange={ownerRequirements.onChange}
          minHeightClass="min-h-[64px]"
        />
      ) : null}

      <div>
        <SectionAnchor id={MACHINE_FORM_SECTION_IDS.integrations} />
        <FormSectionBox title="Integrations" testId="integrations-section">
          {hasIntegrationFields ? (
            <div className="grid grid-cols-2 items-start gap-3 @xl:grid-cols-4 @xl:gap-4">
              {iscored !== null ? (
                <div className="col-span-2 min-w-0">{iscored}</div>
              ) : null}
              {pinballmapUnavailable ? (
                <div className="col-span-2 flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Pinball Map
                  </span>
                  {/* Kept in the box's grid rather than removed: the section
                      still names the integration and says why it is off, so
                      nobody goes looking for it (machine-editing 3.6). */}
                  <div
                    className="flex min-h-9 items-center rounded-md border border-outline-variant px-3 py-1.5 text-sm text-muted-foreground"
                    data-testid="pbm-listing-collapsed"
                  >
                    Disabled. Requires a model listed in their catalog.
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {pinballmap !== null ? (
            <div
              className={
                hasIntegrationFields
                  ? "border-t border-outline-variant pt-3.5"
                  : undefined
              }
            >
              {pinballmap}
            </div>
          ) : null}
        </FormSectionBox>
      </div>
    </div>
  );
}
