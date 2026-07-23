"use client";

import type React from "react";
import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Plus,
  Trophy,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { docToPlainText, type ProseMirrorDoc } from "~/lib/tiptap/types";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import { InlineMarkdownField } from "~/components/machines/settings/InlineMarkdownField";
import { SortableSection } from "~/components/machines/settings/SortableSection";
import { NoteSection } from "~/components/machines/settings/NoteSection";
import { SoftwareSettingsSection } from "~/components/machines/settings/SoftwareSettingsSection";
import { TableSection } from "~/components/machines/settings/TableSection";
import { DipBankSection } from "~/components/machines/settings/DipBankSection";
import {
  type AddSectionSpec,
  type SettingsSection,
  type SettingsSetData,
} from "~/lib/machines/settings-types";

interface SettingsSetCardProps {
  set: SettingsSetData;
  isExpanded: boolean;
  /** Per-set permission to edit (owner/community rules). Governs whether
   *  always-live field inputs, section kebabs/grips, the set kebab, "Add
   *  section", Publish, and Tournament tagging render. Read-only viewers see
   *  none of it. */
  canEdit: boolean;
  /** Whether this viewer may set the set as the Owner's default (owner/admin on
   *  an owner set). Gates the "Set as Owner's default" menu item specifically —
   *  a community set is never eligible even to an editor. */
  canSetDefault: boolean;
  /** Unsaved set (temp id). Preferred/Duplicate/Publish target a persisted row,
   *  so they are disabled until the first save. */
  isNew: boolean;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onToggleExpand: () => void;
  onTogglePreferred: () => void;
  /** Toggle the non-exclusive Tournament tag. */
  onToggleTournament: () => void;
  /** Publish / unpublish the set (private draft ↔ public). */
  onTogglePublish: () => void;
  onRename: (newName: string) => void;
  /** Called after the set-name blur so the parent can flush the auto-save
   *  debounce (plain-text blur path — Task 6 Step 9). */
  onNameBlur: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdateDescription: (value: ProseMirrorDoc | null) => void;
  /** Called when the header description editor blurs, so the parent can flush
   *  the auto-save debounce for this set (rich-text blur path — Task 9). */
  onDescriptionBlur: () => void;
  // Section-level operations (keyed by section id)
  onAddSection: (spec: AddSectionSpec) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (activeId: string, overId: string) => void;
  // Software settings rows
  onUpdateBaseline: (sectionId: string, value: string) => void;
  onAddSoftwareRow: (sectionId: string) => string | undefined;
  onUpdateSoftwareRow: (
    sectionId: string,
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ) => void;
  onDeleteSoftwareRow: (sectionId: string, rowKey: string) => void;
  // Generic table section title (rows reuse the software-row handlers above)
  onUpdateTableTitle: (sectionId: string, title: string) => void;
  // DIP switches
  onRenameDipBank: (sectionId: string, name: string) => void;
  onAddDipSwitch: (sectionId: string) => string | undefined;
  onUpdateDipSwitch: (
    sectionId: string,
    switchKey: string,
    field: "switch" | "position" | "note",
    value: string
  ) => void;
  onDeleteDipSwitch: (sectionId: string, switchKey: string) => void;
  // Free-form note sections
  onUpdateNoteTitle: (sectionId: string, title: string) => void;
  onUpdateNoteBody: (sectionId: string, body: ProseMirrorDoc | null) => void;
  /** Called after any section-field blur (name, cell) so the parent can flush
   *  the auto-save debounce for this set. */
  onSectionBlurFlush: (sectionId: string) => void;
}

function formatShortDate(iso: string): string {
  const parts = iso.split("-");
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return iso;
  return `${String(parseInt(m, 10))}/${String(parseInt(d, 10))}`;
}

interface AddSectionMenuProps {
  hasSoftware: boolean;
  hasPostPositions: boolean;
  hasRubbers: boolean;
  onAdd: (spec: AddSectionSpec) => void;
}

/**
 * The single "Add section" entry point for a set. Surfaces every kind of
 * content a set can hold. Single-instance kinds (software, the two presets)
 * drop off the menu once present; DIP banks and "Other text" repeat, so the
 * menu is never empty.
 */
function AddSectionMenu({
  hasSoftware,
  hasPostPositions,
  hasRubbers,
  onAdd,
}: AddSectionMenuProps): React.JSX.Element {
  return (
    <div className="border-t border-outline-variant/60 py-2.5 max-md:py-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-muted-foreground">
            <Plus aria-hidden="true" />
            Add section
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {!hasSoftware && (
            <DropdownMenuItem
              onSelect={() => {
                onAdd({ kind: "software" });
              }}
            >
              Software settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              onAdd({ kind: "dip" });
            }}
          >
            DIP switch bank
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              onAdd({ kind: "table" });
            }}
          >
            Other table…
          </DropdownMenuItem>
          {!hasPostPositions && (
            <DropdownMenuItem
              onSelect={() => {
                onAdd({
                  kind: "note",
                  title: "Post positions",
                  customTitle: false,
                });
              }}
            >
              Post positions
            </DropdownMenuItem>
          )}
          {!hasRubbers && (
            <DropdownMenuItem
              onSelect={() => {
                onAdd({ kind: "note", title: "Rubbers", customTitle: false });
              }}
            >
              Rubbers
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              onAdd({ kind: "note", title: "", customTitle: true });
            }}
          >
            Other text…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function describeSection(section: SettingsSection): string {
  switch (section.kind) {
    case "software":
      return "the Software settings section";
    case "table":
      return `the ${section.title || "untitled"} table`;
    case "dip":
      return `the ${section.name || "DIP"} bank`;
    case "note":
      return `the ${section.title || "untitled"} section`;
  }
}

export function SettingsSetCard({
  set,
  isExpanded,
  canEdit,
  canSetDefault,
  isNew,
  onMoveSection,
  onToggleExpand,
  onTogglePreferred,
  onToggleTournament,
  onTogglePublish,
  onRename,
  onNameBlur,
  onDuplicate,
  onDelete,
  onUpdateDescription,
  onDescriptionBlur,
  onAddSection,
  onDeleteSection,
  onReorderSections,
  onUpdateBaseline,
  onAddSoftwareRow,
  onUpdateSoftwareRow,
  onDeleteSoftwareRow,
  onUpdateTableTitle,
  onRenameDipBank,
  onAddDipSwitch,
  onUpdateDipSwitch,
  onDeleteDipSwitch,
  onUpdateNoteTitle,
  onUpdateNoteBody,
  onSectionBlurFlush,
}: SettingsSetCardProps): React.JSX.Element {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  // The description block sits flush under the header as a subtitle. At rest
  // an empty description renders nothing (InlineMarkdownField returns null),
  // so we only reserve the wrapper when the user can edit OR there's content
  // to show — keeping description-less cards free of trailing dead space.
  const descriptionIsEmpty =
    !set.description || docToPlainText(set.description).trim() === "";
  const showDescription = canEdit || !descriptionIsEmpty;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const sectionIds = set.sections.map((s) => s.id);

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderSections(String(active.id), String(over.id));
    }
  }

  // Set-level delete confirms via AlertDialog (design bible §17).
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Render one section's body. `canEdit` is passed through — all fields are
  // always-live for permitted users (PP-43q3 pivot).
  function renderSection(section: SettingsSection): React.JSX.Element {
    switch (section.kind) {
      case "software":
        return (
          <SoftwareSettingsSection
            baseline={section.baseline}
            rows={section.rows}
            canEdit={canEdit}
            onBaselineChange={(v) => {
              onUpdateBaseline(section.id, v);
            }}
            onAddRow={() => onAddSoftwareRow(section.id)}
            onUpdateRow={(rowKey, field, value) => {
              onUpdateSoftwareRow(section.id, rowKey, field, value);
            }}
            onDeleteRow={(rowKey) => {
              onDeleteSoftwareRow(section.id, rowKey);
            }}
            onBlurFlush={() => onSectionBlurFlush(section.id)}
          />
        );
      case "table":
        return (
          <TableSection
            title={section.title}
            rows={section.rows}
            canEdit={canEdit}
            onTitleChange={(title) => {
              onUpdateTableTitle(section.id, title);
            }}
            onAddRow={() => onAddSoftwareRow(section.id)}
            onUpdateRow={(rowKey, field, value) => {
              onUpdateSoftwareRow(section.id, rowKey, field, value);
            }}
            onDeleteRow={(rowKey) => {
              onDeleteSoftwareRow(section.id, rowKey);
            }}
            onBlurFlush={() => onSectionBlurFlush(section.id)}
          />
        );
      case "dip":
        return (
          <DipBankSection
            bank={section}
            canEdit={canEdit}
            onRenameBank={(name) => {
              onRenameDipBank(section.id, name);
            }}
            onAddSwitch={() => onAddDipSwitch(section.id)}
            onUpdateSwitch={(switchKey, field, value) => {
              onUpdateDipSwitch(section.id, switchKey, field, value);
            }}
            onDeleteSwitch={(switchKey) => {
              onDeleteDipSwitch(section.id, switchKey);
            }}
            onBlurFlush={() => onSectionBlurFlush(section.id)}
          />
        );
      case "note":
        return (
          <NoteSection
            note={section}
            canEdit={canEdit}
            onTitleChange={(title) => {
              onUpdateNoteTitle(section.id, title);
            }}
            onBodyChange={(body) => {
              onUpdateNoteBody(section.id, body);
            }}
            onTitleBlur={() => onSectionBlurFlush(section.id)}
            onBodyBlur={() => onSectionBlurFlush(section.id)}
          />
        );
    }
  }

  // Badges lead the title (after the chevron). "Owner's default" is exclusive
  // (one per machine); "Tournament" is non-exclusive and can coexist with it.
  const preferredBadge = set.isPreferred && (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge
            className="border-warning/30 bg-warning/10 text-warning"
            variant="outline"
          >
            ★<span className="max-md:hidden">&nbsp;Owner's default</span>
            <span className="sr-only md:hidden">Owner's default</span>
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {canEdit
          ? "Owner's default set — change in the ⋮ menu"
          : "Owner's default set"}
      </TooltipContent>
    </Tooltip>
  );

  const tournamentBadge = set.isTournament && (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge
            className="border-primary/30 bg-primary/10 text-primary"
            variant="outline"
          >
            <Trophy className="size-3" aria-hidden="true" />
            <span className="max-md:hidden">&nbsp;Tournament</span>
            <span className="sr-only md:hidden">Tournament</span>
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {canEdit ? "Tournament set — change in the ⋮ menu" : "Tournament set"}
      </TooltipContent>
    </Tooltip>
  );

  // Kind / visibility chip. A private draft is flagged prominently so its
  // creator knows it isn't shared yet; the ★ Owner's default badge already
  // implies an owner set, so the default gets no extra kind chip.
  const kindBadge = !set.isPublic ? (
    <Badge
      className="border-outline-variant bg-muted text-muted-foreground"
      variant="outline"
    >
      Private draft
    </Badge>
  ) : set.isPreferred ? null : set.isOwnerSet ? (
    <Badge
      className="border-warning/25 bg-warning/5 text-warning"
      variant="outline"
    >
      Owner
    </Badge>
  ) : (
    <Badge variant="secondary">Community</Badge>
  );

  // The set name — always-live input for permitted users, plain text for
  // viewers. Edits buffer into the working copy via onRename; auto-save debounce
  // handles persistence. The input is always present for permitted users so
  // the chevron column is always separate (no "is button" branching).
  const headerTitle = (
    // Spans (not divs) so this can live inside a <button> without invalid
    // <div>-in-<button> nesting when the user is a viewer.
    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <span className="min-w-0 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
        {(preferredBadge || tournamentBadge || kindBadge) && (
          <span className="mr-2 inline-flex flex-wrap items-center gap-1 align-middle">
            {preferredBadge}
            {kindBadge}
            {tournamentBadge}
          </span>
        )}
        <InlineEditableText
          value={set.name}
          onValueChange={onRename}
          canEdit={canEdit}
          required
          placeholder="Name this set"
          ariaLabel="set name"
          inputClassName="h-7 text-sm font-semibold"
          autoComplete="off"
          onBlurCommit={onNameBlur}
        />
      </span>
    </span>
  );

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden transition-colors duration-150 motion-reduce:transition-none",
        "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:-mx-4 sm:max-md:-mx-8",
        set.isPreferred
          ? "border-warning/40 ring-1 ring-warning/30 max-md:ring-0"
          : "border-outline-variant",
        "max-md:border-t-2 max-md:border-t-outline-variant"
      )}
    >
      {/* Header band: title + description + audit line share a faint tinted
          surface so the header reads as one zone on every breakpoint. */}
      <div className="bg-muted max-md:px-4 sm:max-md:px-8">
        {/* Header block — always visible. For permitted users the name is always
            an input, so the chevron lives in its own column (left). For viewers
            the entire row is a single disclosure button. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-3 max-md:px-0 max-md:py-2">
          {canEdit ? (
            // Permitted: chevron is its own button; name input in the title span.
            <>
              <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${set.name || "Unnamed"} settings set`}
                className="-ml-1 rounded p-0.5 text-muted-foreground transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
              >
                <ChevronIcon
                  className="size-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </button>
              {headerTitle}
            </>
          ) : (
            // Viewer: entire title row is the disclosure trigger.
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
              aria-label={`${set.name || "Unnamed"} settings set`}
              className="-mx-1 flex max-w-full grow items-center gap-2.5 rounded px-1 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-md:shrink-0 md:flex-1 motion-reduce:transition-none"
            >
              <ChevronIcon
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none"
                aria-hidden="true"
              />
              {headerTitle}
            </button>
          )}

          {/* Set-level ⋮ menu — permitted users only. */}
          {canEdit && (
            <span className="ml-auto flex shrink-0 items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    aria-label="More options for this set"
                  >
                    <MoreVertical className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* These act on a persisted row, so they're disabled until an
                      unsaved (temp-id) set is first saved. The Owner's default
                      is always public, so it gets no Publish toggle. */}
                  {!set.isPreferred && (
                    <DropdownMenuItem
                      disabled={isNew}
                      onSelect={onTogglePublish}
                    >
                      {set.isPublic ? "Make private" : "Publish"}
                    </DropdownMenuItem>
                  )}
                  {canSetDefault && (
                    <DropdownMenuItem
                      disabled={isNew}
                      onSelect={onTogglePreferred}
                    >
                      {set.isPreferred
                        ? "Unset owner's default"
                        : "Set as owner's default"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    disabled={isNew}
                    onSelect={onToggleTournament}
                  >
                    {set.isTournament
                      ? "Remove Tournament tag"
                      : "Tag as Tournament"}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isNew} onSelect={onDuplicate}>
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      setDeleteDialogOpen(true);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          )}
        </div>

        {canEdit && (
          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete "{set.name || "this set"}"?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes the whole settings set and everything in it. This
                  can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction type="button" onClick={onDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Description — always-live for permitted users; at rest renders
            as finished text (or nothing when empty). pl-11 aligns under the
            set name (past the chevron). */}
        {showDescription && (
          <div className="-mt-1 pb-1 pl-11 pr-4 max-md:px-0">
            <InlineMarkdownField
              value={set.description}
              canEdit={canEdit}
              placeholder="Add a short description…"
              compact
              onValueChange={onUpdateDescription}
              onBlur={onDescriptionBlur}
            />
          </div>
        )}

        {/* Audit line — sits under the description (or directly under the header
            when there is none). */}
        <div className="flex items-center gap-2 pb-3 pl-11 pr-4 max-md:px-0 max-md:pb-2">
          <p className="min-w-0 text-xs text-muted-foreground">
            updated by {set.updatedBy} {formatShortDate(set.updatedAt)}
          </p>
        </div>
      </div>

      {/* Expanded body. */}
      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-0 max-md:pb-3 sm:max-md:px-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sectionIds}
              strategy={verticalListSortingStrategy}
            >
              {set.sections.map((section, index) => (
                <SortableSection
                  key={section.id}
                  id={section.id}
                  canEdit={canEdit}
                  isFirst={index === 0}
                  isLast={index === set.sections.length - 1}
                  describe={describeSection(section)}
                  onDelete={() => {
                    onDeleteSection(section.id);
                  }}
                  onMoveUp={() => {
                    onMoveSection(section.id, "up");
                  }}
                  onMoveDown={() => {
                    onMoveSection(section.id, "down");
                  }}
                >
                  {renderSection(section)}
                </SortableSection>
              ))}
            </SortableContext>
          </DndContext>

          {set.sections.length === 0 && (
            <p className="border-t border-outline-variant/60 py-3 text-sm italic text-muted-foreground">
              No settings recorded yet.
            </p>
          )}

          {/* "+ Add section" is persistent for permitted users — NOT gated
              behind any edit mode. Read-only viewers never see it. */}
          {canEdit && (
            <AddSectionMenu
              hasSoftware={set.sections.some((s) => s.kind === "software")}
              hasPostPositions={hasPreset(set, "Post positions")}
              hasRubbers={hasPreset(set, "Rubbers")}
              onAdd={onAddSection}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function hasPreset(set: SettingsSetData, title: string): boolean {
  return set.sections.some(
    (s) => s.kind === "note" && !s.customTitle && s.title === title
  );
}
