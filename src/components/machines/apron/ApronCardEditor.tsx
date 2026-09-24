"use client";

import type React from "react";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { useIsMobile } from "~/hooks/use-is-mobile";
import {
  APRON_CARD_SIZES,
  type ApronCardContent,
  type ApronCardSize,
} from "~/lib/machines/apron-card";
import { cn } from "~/lib/utils";
import { saveApronCardAction } from "~/app/(app)/m/[initials]/apron/actions";
import { ApronCardExportMenu } from "./ApronCardExportMenu";
import { ApronCardPreview } from "./ApronCardPreview";

/** The card fields a person edits (spec §3). */
export interface ApronCardDraft {
  size: ApronCardSize | null;
  useCustomDescription: boolean;
  customDescription: string;
  tip: string;
  tipEnabled: boolean;
}

/** Identity lines the editor never changes (spec §2.1). */
export type ApronCardIdentity = Pick<
  ApronCardContent,
  "name" | "edition" | "manufacturer" | "year" | "ownerName"
>;

export function draftContent(
  identity: ApronCardIdentity,
  mainDescription: string,
  draft: ApronCardDraft
): ApronCardContent {
  return {
    ...identity,
    description: draft.useCustomDescription
      ? draft.customDescription
      : mainDescription,
    tip: draft.tip,
    tipEnabled: draft.tipEnabled,
  };
}

function sameDraft(a: ApronCardDraft, b: ApronCardDraft): boolean {
  return (
    a.size === b.size &&
    a.useCustomDescription === b.useCustomDescription &&
    a.customDescription === b.customDescription &&
    a.tip === b.tip &&
    a.tipEnabled === b.tipEnabled
  );
}

interface ApronCardEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineId: string;
  machineInitials: string;
  identity: ApronCardIdentity;
  mainDescription: string;
  saved: ApronCardDraft;
  savedAt: string | null;
  scanUrl: string;
  canExport: boolean;
}

/**
 * The apron card editor (spec §3), opened from the Service tab and the Manage
 * tab. One component: a large dialog on desktop, a bottom sheet on mobile
 * (design bible §17). The preview stays pinned above the form.
 */
export function ApronCardEditor({
  open,
  onOpenChange,
  ...props
}: ApronCardEditorProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const title = `Apron card · ${props.identity.name}`;
  const description =
    "Size, description, and tip for this machine's printed card.";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] gap-0 rounded-t-xl bg-card p-0"
        >
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">
              {description}
            </SheetDescription>
          </SheetHeader>
          {open ? (
            <EditorBody
              {...props}
              onClose={() => {
                onOpenChange(false);
              }}
              compact
            />
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-4rem)] flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-5 pb-1">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <EditorBody
            {...props}
            onClose={() => {
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditorBody({
  onClose,
  compact = false,
  machineId,
  machineInitials,
  identity,
  mainDescription,
  saved: initialSaved,
  savedAt: initialSavedAt,
  scanUrl,
  canExport,
}: Omit<ApronCardEditorProps, "open" | "onOpenChange"> & {
  onClose: () => void;
  compact?: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const id = useId();
  const [saved, setSaved] = useState(initialSaved);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [draft, setDraft] = useState(initialSaved);
  const [overflowing, setOverflowing] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const update = (patch: Partial<ApronCardDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const dirty = savedAt === null || !sameDraft(draft, saved);
  const content = draftContent(identity, mainDescription, draft);
  const savedContent = draftContent(identity, mainDescription, saved);
  const size = draft.size;

  const canSave = size !== null && dirty && !overflowing && !isSaving;
  const canExportNow =
    canExport &&
    savedAt !== null &&
    saved.size !== null &&
    !dirty &&
    !overflowing;

  let status: React.ReactNode;
  if (size === null) {
    status = "Choose an apron card size";
  } else if (overflowing) {
    status = (
      <span className="inline-flex items-center gap-1.5 text-warning">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Text too long for the card
      </span>
    );
  } else if (isSaving) {
    status = "Saving…";
  } else if (dirty) {
    status = savedAt === null ? "Not saved yet" : "Unsaved changes";
  } else {
    status = "Saved";
  }

  const handleSave = (): void => {
    if (size === null) return;
    startSaving(async () => {
      const result = await saveApronCardAction({
        machineId,
        size,
        useCustomDescription: draft.useCustomDescription,
        description: draft.customDescription,
        tip: draft.tip,
        tipEnabled: draft.tipEnabled,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setSaved(draft);
      setSavedAt(result.value.savedAt);
      router.refresh();
    });
  };

  const handleCancel = (): void => {
    setDraft(saved);
    onClose();
  };

  return (
    <>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          compact ? "px-4" : "pr-5 pl-6"
        )}
      >
        {/* Preview — pinned while the form scrolls beneath it. */}
        <div
          className={cn(
            "sticky top-0 z-10 border-b border-outline-variant bg-card",
            compact ? "pt-1 pb-3" : "pt-4 pb-3"
          )}
        >
          <div
            className={cn(
              "relative flex justify-center rounded-lg border border-outline-variant bg-background",
              compact ? "p-2" : "p-4"
            )}
          >
            {size === null ? (
              <div className="flex h-[150px] w-full flex-col items-center justify-center gap-2 text-sm font-medium text-on-surface sm:h-[283px]">
                <AlertTriangle
                  className="size-5 text-warning"
                  aria-hidden="true"
                />
                Choose an apron card size
              </div>
            ) : (
              <ApronCardPreview
                content={content}
                size={size}
                scanUrl={scanUrl}
                onOverflowChange={setOverflowing}
                className="flex justify-center"
              />
            )}
            {overflowing && size !== null ? (
              <span className="absolute top-2 right-2 rounded-md bg-warning px-2 py-0.5 text-xs font-semibold text-background">
                Text cut off
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-5 pt-4 pb-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-size`}>Apron card size</Label>
            <Select
              value={size ?? ""}
              onValueChange={(value) => {
                if (value === "stern" || value === "wpc")
                  update({ size: value });
              }}
            >
              <SelectTrigger id={`${id}-size`} className="w-full">
                <SelectValue placeholder="Choose a size…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(APRON_CARD_SIZES).map(([key, option]) => (
                  <SelectItem key={key} value={key}>
                    {option.label} · {option.dimensions}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Description</legend>
            <DescriptionSourceRadio
              name={`${id}-description-source`}
              checked={!draft.useCustomDescription}
              onSelect={() => {
                update({ useCustomDescription: false });
              }}
              label="Use the machine's description"
            />
            <DescriptionSourceRadio
              name={`${id}-description-source`}
              checked={draft.useCustomDescription}
              onSelect={() => {
                update({ useCustomDescription: true });
              }}
              label="Use a custom description"
            />
            {draft.useCustomDescription ? (
              <Textarea
                aria-label="Custom description"
                value={draft.customDescription}
                onChange={(e) => {
                  update({ customDescription: e.target.value });
                }}
                maxLength={1500}
                rows={4}
                className="mt-1"
              />
            ) : (
              <Textarea
                aria-label="Machine description (edited on the Info tab)"
                value={mainDescription}
                placeholder="No machine description"
                readOnly
                rows={4}
                className="mt-1 text-muted-foreground"
              />
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <Checkbox
                id={`${id}-tip-enabled`}
                checked={draft.tipEnabled}
                onCheckedChange={(checked) => {
                  update({ tipEnabled: checked === true });
                }}
              />
              <Label htmlFor={`${id}-tip-enabled`}>Include a tip</Label>
            </div>
            <Label htmlFor={`${id}-tip`} className="mt-2">
              Tip
            </Label>
            <Textarea
              id={`${id}-tip`}
              value={draft.tip}
              onChange={(e) => {
                update({ tip: e.target.value });
              }}
              disabled={!draft.tipEnabled}
              maxLength={1500}
              rows={2}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 border-t border-outline-variant",
          compact ? "px-4 py-3" : "px-6 py-4"
        )}
      >
        <span
          className="mr-auto text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {status}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          Cancel
        </Button>
        {canExport ? (
          <ApronCardExportMenu
            machineInitials={machineInitials}
            content={savedContent}
            size={saved.size}
            scanUrl={scanUrl}
            disabled={!canExportNow}
            side="top"
          />
        ) : null}
        <Button size="sm" onClick={handleSave} disabled={!canSave}>
          Save
        </Button>
      </div>
    </>
  );
}

function DescriptionSourceRadio({
  name,
  checked,
  onSelect,
  label,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          checked ? "border-primary" : "border-outline-variant"
        )}
      >
        {checked ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      {label}
    </label>
  );
}
