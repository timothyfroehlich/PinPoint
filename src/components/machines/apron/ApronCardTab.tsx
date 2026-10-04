"use client";

import type React from "react";
import { useId, useMemo, useState, useTransition } from "react";
import { AlertTriangle, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { SegmentedToggle } from "~/components/machines/PinballmapListingControl";
import {
  MachineFormActionBar,
  PinnedActionBarSpacer,
} from "~/components/machines/machine-form/MachineFormActionBar";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { useUnsavedChangesGuard } from "~/hooks/use-unsaved-changes-guard";
import {
  APRON_CARD_SIZES,
  APRON_CARD_TEMPLATES,
  apronCardPixelSize,
  isApronCardTemplate,
  cardFaceContent,
  type ApronCardIdentity,
  type ApronCardSize,
  type SavedApronCard,
} from "~/lib/machines/apron-card";
import {
  blankDraft,
  draftFromSaved,
  draftsDirty,
  nextCardName,
  type ApronCardDraft,
} from "~/lib/machines/apron-card-drafts";
import { docIsEmpty, type ProseMirrorDoc } from "~/lib/tiptap/types";
import { formatCreditNames } from "~/lib/opdb/credits";
import { saveApronCardsAction } from "~/app/(app)/m/[initials]/(tabs)/apron/actions";
import { APRON_CARDS_MAX } from "~/app/(app)/m/[initials]/(tabs)/apron/schemas";
import { DeleteCardDialog, RenameCardDialog } from "./ApronCardDialogs";
import {
  ApronCardExportMenu,
  type ExportableApronCard,
} from "./ApronCardExportMenu";
import { ApronCardPreview } from "./ApronCardPreview";

// The card prints list markers (spec §3.7), so its editors show them too.
const CARD_EDITOR_CLASSES =
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5";

const TEXT_SOURCES = [
  { value: "machine", label: "Machine description" },
  { value: "card", label: "Card description" },
] as const;

export interface ApronCardTabProps {
  machineId: string;
  machineInitials: string;
  identity: ApronCardIdentity;
  /** The machine's saved main description (spec §3.2). */
  mainDescription: ProseMirrorDoc | null;
  savedCards: SavedApronCard[];
  scanUrl: string;
  /** The machine-management capability (spec §3.6, §11.7). */
  canEdit: boolean;
}

/**
 * The Apron card tab (spec apron-cards §3, §11): one saved card at a time
 * with a switcher, a live preview at print size, and one Save for every card.
 * Members without the machine-management capability see Preview and Export
 * only (§3.8).
 */
export function ApronCardTab({
  machineId,
  machineInitials,
  identity,
  mainDescription,
  savedCards,
  scanUrl,
  canEdit,
}: ApronCardTabProps): React.JSX.Element {
  const id = useId();
  const [saved, setSaved] = useState(savedCards);
  const [drafts, setDrafts] = useState(() => savedCards.map(draftFromSaved));
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    savedCards[0]?.id ?? null
  );
  // Bumped whenever card text changes other than by typing (copy, cancel,
  // save), so the rich-text editors remount with the new content.
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Held apart from the selection, which moves to a neighbour as soon as the
  // card is deleted, while the dialog is still closing.
  const [deleteName, setDeleteName] = useState("");
  const [isSaving, startSaving] = useTransition();

  const dirty = deletedIds.length > 0 || draftsDirty(drafts, saved);
  const selected = drafts.find((card) => card.key === selectedKey) ?? null;
  const missingSize = drafts.find((card) => card.size === null) ?? null;

  const resetTo = (cards: SavedApronCard[], keepKey: string | null): void => {
    const next = cards.map(draftFromSaved);
    setDrafts(next);
    setDeletedIds([]);
    setSelectedKey(
      next.some((card) => card.key === keepKey)
        ? keepKey
        : (next[0]?.key ?? null)
    );
    setEditorEpoch((n) => n + 1);
  };

  const { dialog: unsavedDialog, openConfirm } = useUnsavedChangesGuard({
    isDirty: dirty,
    onDiscard: () => {
      resetTo(saved, selectedKey);
    },
  });

  const update = (patch: Partial<ApronCardDraft>): void => {
    if (!selected) return;
    setDrafts((current) =>
      current.map((card) =>
        card.key === selected.key ? { ...card, ...patch } : card
      )
    );
  };

  const addCard = (): void => {
    const key = `new-${newCount}`;
    setNewCount((n) => n + 1);
    setDrafts((current) => [
      ...current,
      blankDraft(key, nextCardName(current.map((card) => card.name))),
    ]);
    setSelectedKey(key);
  };

  const deleteSelected = (): void => {
    if (!selected) return;
    const index = drafts.findIndex((card) => card.key === selected.key);
    const rest = drafts.filter((card) => card.key !== selected.key);
    setDrafts(rest);
    if (selected.id) {
      const deletedId = selected.id;
      setDeletedIds((current) => [...current, deletedId]);
    }
    setSelectedKey(rest[Math.min(index, rest.length - 1)]?.key ?? null);
  };

  const copyFrom = (source: ApronCardDraft): void => {
    update({
      useCustomDescription: source.useCustomDescription,
      description: source.description,
      tip: source.tip,
      tipEnabled: source.tipEnabled,
    });
    setEditorEpoch((n) => n + 1);
  };

  const handleSave = (): void => {
    // Every saved card has a size (§4.3); Save is disabled until each does.
    const sized = drafts.flatMap((card) =>
      card.size ? [{ ...card, size: card.size }] : []
    );
    if (sized.length !== drafts.length) return;
    startSaving(async () => {
      const result = await saveApronCardsAction({
        machineId,
        deletedIds,
        cards: sized.map((card) => ({
          ...(card.id ? { id: card.id } : {}),
          name: card.name,
          size: card.size,
          template: card.template,
          useCustomDescription: card.useCustomDescription,
          description: card.description,
          tip: card.tip,
          tipEnabled: card.tipEnabled,
          designEnabled: card.designEnabled,
          artEnabled: card.artEnabled,
        })),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const stored = result.value.cards;
      // A card added in this save is found again by its name (§11.2).
      const keepKey =
        selected?.id ??
        stored.find((card) => card.name === selected?.name)?.id ??
        null;
      setSaved(stored);
      resetTo(stored, keepKey);
      toast.success("Cards saved");
    });
  };

  const exportable = useMemo<ExportableApronCard[]>(
    () =>
      saved.map((card) => ({
        id: card.id,
        name: card.name,
        size: card.size,
        template: card.template,
        content: cardFaceContent(identity, mainDescription, card),
      })),
    [saved, identity, mainDescription]
  );
  const exportMenu = (className?: string): React.JSX.Element => (
    <ApronCardExportMenu
      machineInitials={machineInitials}
      scanUrl={scanUrl}
      cards={exportable}
      initialCardId={selected?.id ?? null}
      {...(className ? { className } : {})}
    />
  );

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col gap-4" inert={isSaving}>
        <section
          aria-label="Apron card"
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant px-4 py-10 text-center"
        >
          <p className="text-sm text-muted-foreground">No saved cards</p>
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={addCard}>
              <Plus aria-hidden="true" />
              Add card
            </Button>
          ) : null}
        </section>
        {canEdit && dirty ? (
          <ActionBar
            status={<UnsavedStatus />}
            onCancel={() => {
              openConfirm();
            }}
            onSave={handleSave}
            saveDisabled={isSaving}
            saving={isSaving}
          />
        ) : null}
        {unsavedDialog}
      </div>
    );
  }

  const size: ApronCardSize = selected?.size ?? "stern";
  const previewWidth = apronCardPixelSize(size).width + 40;
  const content = selected
    ? cardFaceContent(identity, mainDescription, selected)
    : null;
  const otherCards = drafts.filter((card) => card.key !== selected?.key);
  // The preview column is the card's printed width plus the frame's padding.
  const previewStyle: React.CSSProperties & Record<`--${string}`, string> = {
    "--apron-preview-width": `${previewWidth}px`,
  };

  let status: React.ReactNode = null;
  if (isSaving) status = <span className="text-muted-foreground">Saving…</span>;
  else if (missingSize && dirty)
    status = (
      <span className="text-warning">
        Choose an apron size for {missingSize.name}
      </span>
    );
  else if (dirty) status = <UnsavedStatus />;

  const preview = (
    <div className="flex flex-col gap-2.5 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Preview</span>
        {exportMenu("lg:hidden")}
      </div>
      <div className="flex justify-center rounded-lg bg-card p-3 sm:p-5">
        {selected?.size && content ? (
          <ApronCardPreview
            key={selected.key}
            content={content}
            size={selected.size}
            template={selected.template}
            scanUrl={scanUrl}
            onOverflowChange={setOverflowing}
            outlined
            className="flex justify-center"
          />
        ) : (
          <div className="flex aspect-[529/283] w-full max-w-[529px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
            Choose an apron size
          </div>
        )}
      </div>
      {overflowing && selected?.size ? (
        <p
          className="flex items-center gap-1.5 text-sm text-warning"
          role="status"
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          Doesn&apos;t fit on the card
        </p>
      ) : null}
    </div>
  );

  return (
    // Inert while saving: a successful save replaces every card with the
    // stored copy, so an edit made mid-save would be lost.
    <div className="flex flex-col gap-4" inert={isSaving}>
      <div className="flex items-center gap-2">
        <Select
          value={selectedKey ?? ""}
          onValueChange={(value) => {
            setSelectedKey(value);
          }}
        >
          <SelectTrigger
            aria-label="Saved card"
            className="min-w-0 flex-1 sm:w-56 sm:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {drafts.map((card) => (
              <SelectItem key={card.key} value={card.key}>
                {card.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit ? (
          <>
            <Button
              variant="outline"
              onClick={addCard}
              disabled={drafts.length >= APRON_CARDS_MAX}
              aria-label="Add card"
              className="max-sm:size-9 max-sm:px-0"
            >
              <Plus aria-hidden="true" />
              <span className="max-sm:sr-only">Add card</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Card actions">
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameOpen(true);
                  }}
                >
                  Rename card…
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={otherCards.length === 0}>
                    Copy description and tip from
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {otherCards.map((card) => (
                      <DropdownMenuItem
                        key={card.key}
                        onSelect={() => {
                          copyFrom(card);
                        }}
                      >
                        {card.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setDeleteName(selected?.name ?? "");
                    setDeleteOpen(true);
                  }}
                >
                  Delete card…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
        <div className="ml-auto hidden lg:block">{exportMenu()}</div>
      </div>

      {selected && canEdit ? (
        <div
          className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,var(--apron-preview-width))] lg:items-start"
          style={previewStyle}
        >
          <div className="flex flex-col gap-5">
            <div className="@container">
              <div className="grid gap-5 @md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-size`}>Apron size</Label>
                  <Select
                    value={selected.size ?? ""}
                    onValueChange={(value) => {
                      if (value === "stern" || value === "wpc") {
                        update({ size: value });
                      }
                    }}
                  >
                    <SelectTrigger
                      id={`${id}-size`}
                      className="w-full"
                      aria-invalid={selected.size === null}
                    >
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

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-template`}>Template</Label>
                  <Select
                    value={selected.template}
                    onValueChange={(value) => {
                      if (isApronCardTemplate(value))
                        update({ template: value });
                    }}
                  >
                    <SelectTrigger id={`${id}-template`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APRON_CARD_TEMPLATES).map(
                        ([key, option]) => (
                          <SelectItem key={key} value={key}>
                            {option.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Card text</legend>
              <SegmentedToggle
                label="Card text"
                options={TEXT_SOURCES}
                value={selected.useCustomDescription ? "card" : "machine"}
                disabled={false}
                onChange={(value) => {
                  update({ useCustomDescription: value === "card" });
                }}
                testId="apron-card-text-source"
              />
              {selected.useCustomDescription ? (
                <RichTextEditor
                  key={`${selected.key}:description:${editorEpoch}`}
                  content={selected.description}
                  onChange={(doc) => {
                    update({ description: doc });
                  }}
                  formats="card"
                  className={CARD_EDITOR_CLASSES}
                  ariaLabel="Card description"
                  placeholder="Text for this card only"
                />
              ) : (
                <div className="rounded-md border border-outline-variant px-3 py-2 text-sm text-muted-foreground">
                  {mainDescription && !docIsEmpty(mainDescription) ? (
                    <RichTextDisplay content={mainDescription} />
                  ) : (
                    <p>No machine description</p>
                  )}
                  <p className="mt-2 text-xs">Edited on the Manage tab</p>
                </div>
              )}
            </fieldset>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium" id={`${id}-tip-label`}>
                  Tip
                </span>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`${id}-tip-enabled`}
                    className="font-normal text-muted-foreground"
                  >
                    On card
                  </Label>
                  <Switch
                    id={`${id}-tip-enabled`}
                    checked={selected.tipEnabled}
                    onCheckedChange={(checked) => {
                      update({ tipEnabled: checked });
                    }}
                  />
                </div>
              </div>
              <RichTextEditor
                key={`${selected.key}:tip:${editorEpoch}`}
                content={selected.tip}
                onChange={(doc) => {
                  update({ tip: doc });
                }}
                formats="card"
                className={CARD_EDITOR_CLASSES}
                ariaLabel="Tip"
                placeholder="A tip for players"
              />
            </div>

            {/* Only the Standard template shows credits (§10.2, §10.5). */}
            {selected.template === "standard" ? (
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-sm font-medium">Credits</legend>
                <CreditCheckbox
                  id={`${id}-design`}
                  label="Design"
                  names={identity.credits.design}
                  checked={selected.designEnabled}
                  onCheckedChange={(checked) => {
                    update({ designEnabled: checked });
                  }}
                />
                <CreditCheckbox
                  id={`${id}-art`}
                  label="Art"
                  names={identity.credits.art}
                  checked={selected.artEnabled}
                  onCheckedChange={(checked) => {
                    update({ artEnabled: checked });
                  }}
                />
              </fieldset>
            ) : null}
          </div>
          {preview}
        </div>
      ) : (
        <div className="max-w-[616px]">{preview}</div>
      )}

      {canEdit ? (
        <>
          <ActionBar
            status={status}
            onCancel={() => {
              openConfirm();
            }}
            onSave={handleSave}
            saveDisabled={!dirty || isSaving || missingSize !== null}
            cancelDisabled={!dirty || isSaving}
            saving={isSaving}
          />
          <PinnedActionBarSpacer />
          {selected ? (
            <>
              <RenameCardDialog
                open={renameOpen}
                onOpenChange={setRenameOpen}
                name={selected.name}
                otherNames={otherCards.map((card) => card.name)}
                onRename={(name) => {
                  update({ name });
                }}
              />
              <DeleteCardDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                name={deleteName}
                onDelete={deleteSelected}
              />
            </>
          ) : null}
        </>
      ) : null}
      {unsavedDialog}
    </div>
  );
}

function UnsavedStatus(): React.JSX.Element {
  return <span className="text-warning">Unsaved changes</span>;
}

function ActionBar({
  status,
  onCancel,
  onSave,
  saveDisabled,
  cancelDisabled = false,
  saving,
}: {
  status: React.ReactNode;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  cancelDisabled?: boolean;
  saving: boolean;
}): React.JSX.Element {
  return (
    <div className="md:border-t md:border-outline-variant">
      <MachineFormActionBar
        status={
          <span
            className="mr-auto min-w-0 truncate text-sm"
            role="status"
            aria-live="polite"
          >
            {status}
          </span>
        }
      >
        <Button variant="outline" onClick={onCancel} disabled={cancelDisabled}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saveDisabled}>
          {saving ? "Saving…" : "Save cards"}
        </Button>
      </MachineFormActionBar>
    </div>
  );
}

/** One credit role's display setting, with the names it would print. */
function CreditCheckbox({
  id,
  label,
  names,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  names: string[];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => {
          onCheckedChange(value === true);
        }}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="flex-wrap gap-x-1.5 leading-snug">
        {label}
        <span className="font-normal text-muted-foreground">
          {formatCreditNames(names) ?? "Unknown"}
        </span>
      </Label>
    </div>
  );
}
