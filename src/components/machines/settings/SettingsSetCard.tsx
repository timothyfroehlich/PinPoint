"use client";

import type React from "react";
import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Plus,
  Pencil,
  Check,
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
  /** Permission to edit at all (owner/tech+). Governs the Edit button,
   *  the kebab, and the Preferred toggle. */
  canEdit: boolean;
  /** Whether THIS set is currently in content-edit mode. */
  isEditing: boolean;
  /** Unsaved set (temp id). Preferred/Duplicate target a persisted row, so they
   *  are disabled until the first save. */
  isNew: boolean;
  /** A save for THIS set is in flight (Done → "Saving…", disabled). */
  isSaving: boolean;
  /** This set just saved — briefly confirm with "Saved!" on the button. */
  justSaved: boolean;
  /** Editing and the content differs from the last save (or never saved) —
   *  drives the "Unsaved changes" marker on the audit line. */
  isDirty: boolean;
  onToggleExpand: () => void;
  onToggleEdit: () => void;
  onTogglePreferred: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdateDescription: (value: ProseMirrorDoc | null) => void;
  // Section-level operations (keyed by section id)
  onAddSection: (spec: AddSectionSpec) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (activeId: string, overId: string) => void;
  // Software settings rows
  onUpdateBaseline: (sectionId: string, value: string) => void;
  onUpdateBaselineNote: (sectionId: string, value: string) => void;
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
 * drop off the menu once present; DIP banks and Other/Notes repeat, so the
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
              // Blank title → the new section opens with its title field
              // focused so the user names it, rather than defaulting to "Notes".
              onAdd({ kind: "note", title: "", customTitle: true });
            }}
          >
            Other / Notes…
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
  isEditing,
  isNew,
  isSaving,
  justSaved,
  isDirty,
  onToggleExpand,
  onToggleEdit,
  onTogglePreferred,
  onRename,
  onDuplicate,
  onDelete,
  onUpdateDescription,
  onAddSection,
  onDeleteSection,
  onReorderSections,
  onUpdateBaseline,
  onUpdateBaselineNote,
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
}: SettingsSetCardProps): React.JSX.Element {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const nameMissing = set.name.trim() === "";
  // Custom (Other/Notes) and table sections must be titled before edit mode
  // can be left — presets and DIP banks carry default titles, so only these
  // two can be blank.
  const sectionTitleMissing = set.sections.some(
    (s) =>
      (s.kind === "note" && s.customTitle && s.title.trim() === "") ||
      (s.kind === "table" && s.title.trim() === "")
  );
  const blockDone = isEditing && (nameMissing || sectionTitleMissing);
  const hasSoftware = set.sections.some((s) => s.kind === "software");
  const hasPreset = (title: string): boolean =>
    set.sections.some(
      (s) => s.kind === "note" && !s.customTitle && s.title === title
    );
  // Content edits (name, description, cells, add/delete, reorder) unlock only
  // when this set is in edit mode. Set-level ops (kebab, preferred) use canEdit.
  const contentEditable = canEdit && isEditing;
  // Editor viewing this set (can edit, but not editing right now): reserve the
  // edit affordances' footprint at desktop widths so clicking Edit reveals them
  // in place instead of reflowing the card. Read-only viewers never reserve.
  const reserveEditUi = canEdit && !isEditing;
  // The description block sits flush under the header as a subtitle. In view
  // mode an empty description renders nothing, so skip the wrapper entirely to
  // avoid trailing dead space below description-less cards.
  const descriptionIsEmpty =
    !set.description || docToPlainText(set.description).trim() === "";
  const showDescription = contentEditable || !descriptionIsEmpty;

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

  // Set-level delete confirms via AlertDialog (design bible §17) — the most
  // destructive action on the page gets the most explicit confirmation.
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Section deletion is confirmed by the two-tap ConfirmingDeleteButton in
  // SortableSection (no window.confirm — the armed second tap IS the confirm).

  function renderSection(section: SettingsSection): React.JSX.Element {
    switch (section.kind) {
      case "software":
        return (
          <SoftwareSettingsSection
            baseline={section.baseline}
            baselineNote={section.baselineNote}
            rows={section.rows}
            canEdit={contentEditable}
            reserveEditUi={reserveEditUi}
            onBaselineChange={(v) => {
              onUpdateBaseline(section.id, v);
            }}
            onBaselineNoteChange={(v) => {
              onUpdateBaselineNote(section.id, v);
            }}
            onAddRow={() => onAddSoftwareRow(section.id)}
            onUpdateRow={(rowKey, field, value) => {
              onUpdateSoftwareRow(section.id, rowKey, field, value);
            }}
            onDeleteRow={(rowKey) => {
              onDeleteSoftwareRow(section.id, rowKey);
            }}
          />
        );
      case "table":
        return (
          <TableSection
            title={section.title}
            rows={section.rows}
            canEdit={contentEditable}
            reserveEditUi={reserveEditUi}
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
          />
        );
      case "dip":
        return (
          <DipBankSection
            bank={section}
            canEdit={contentEditable}
            reserveEditUi={reserveEditUi}
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
          />
        );
      case "note":
        return (
          <NoteSection
            note={section}
            canEdit={contentEditable}
            onTitleChange={(title) => {
              onUpdateNoteTitle(section.id, title);
            }}
            onBodyChange={(body) => {
              onUpdateNoteBody(section.id, body);
            }}
          />
        );
    }
  }

  // Preferred badge leads the title (after the chevron) so it lives on the
  // name's line instead of wrapping with the controls block.
  const preferredBadge = set.isPreferred && (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge
            className="border-warning/30 bg-warning/10 text-warning"
            variant="outline"
          >
            ★<span className="max-md:hidden">&nbsp;Preferred</span>
            <span className="sr-only md:hidden">Preferred</span>
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {canEdit ? "Preferred set — change in the ⋮ menu" : "Preferred set"}
      </TooltipContent>
    </Tooltip>
  );

  // Name + meta, shared by both header modes. The name is editable only in
  // edit mode (otherwise InlineEditableText renders plain text — safe to nest
  // inside the view-mode toggle <button>).
  const headerTitle = (
    // Spans (not divs) so this can live inside the view-mode <button> without
    // invalid <div>-in-<button> nesting.
    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <span className="min-w-0 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
        {/* Badge joins the name's inline flow in BOTH modes — identical layout
            view↔edit so toggling Edit never nudges the name sideways. A long
            name wraps under the star rather than dropping whole to a new line. */}
        {preferredBadge && (
          <span className="mr-2 inline-flex align-middle">
            {preferredBadge}
          </span>
        )}
        <InlineEditableText
          value={set.name}
          onValueChange={onRename}
          canEdit={contentEditable}
          required
          placeholder="Name this set"
          ariaLabel="set name"
          inputClassName="h-7 text-sm font-semibold"
        />
      </span>
    </span>
  );

  return (
    <Card
      className={cn(
        // gap-0 overrides shadcn's default gap-6: the header, description, and
        // body stack with their own paddings instead of a 24px gutter between
        // each, which was the source of the dead space in the header area.
        "gap-0 overflow-hidden transition-colors duration-150 motion-reduce:transition-none",
        // Mobile: strip the card chrome (border/bg/shadow/rounding) so sets read
        // as a flat divided list; the parent supplies the dividers between them.
        // Negative margins bleed the set to the screen edge (mirroring
        // MainLayout's px-4 / sm:px-8 gutters) so the divider and the header
        // band run edge-to-edge; content padding is restored inside.
        "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:-mx-4 sm:max-md:-mx-8",
        set.isPreferred
          ? "border-warning/40 ring-1 ring-warning/30 max-md:ring-0"
          : "border-outline-variant",
        // Last so it wins over border-0 and the preferred border color: on
        // mobile every set carries a strong 2px top rule — the divider between
        // sets (and between the tab header and the first set). Deliberately
        // heavier than the 1px/60% hairlines between sections inside a set.
        "max-md:border-t-2 max-md:border-t-outline-variant"
      )}
    >
      {/* Header band: title + description + audit line share a faint tinted
          surface so the header reads as one zone on every breakpoint. Mobile:
          flush under the 2px divider, edge-to-edge (the px restores the page
          gutters the Card's negative margins bled through), giving each set a
          card-like identity without giving up any horizontal space. Desktop:
          spans the card, clipped by its rounded corners. */}
      {/* bg-muted (#27272a, opaque): the same elevation token table headers
          use, ~1.3:1 vs the page bg with the muted audit text at ~5.8:1 AA.
          A lighter band (≳16% white) would push that text below the 4.5:1
          floor — don't brighten without rechecking. */}
      <div className="bg-muted max-md:px-4 sm:max-md:px-8">
        {/* Header block — always visible */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-3 max-md:px-0 max-md:py-2">
          {isEditing ? (
            // Edit mode: the card is locked open, so the title area is a plain
            // (non-collapsing) row rather than a toggle button.
            <>
              <ChevronIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              {headerTitle}
            </>
          ) : (
            // View mode: a real <button> disclosure trigger (CORE-A11Y-004).
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
              aria-label={`${set.name || "Unnamed"} settings set`}
              // On mobile the title sizes to its natural one-line width (grow keeps
              // basis:auto; max-md:shrink-0 refuses compression) capped at the full
              // row (max-w-full) — a name that doesn't fit beside the controls pushes
              // the whole controls group onto a second row instead of wrapping
              // mid-title next to them. Desktop keeps flex-1 (basis:0) so the title
              // shrinks-and-wraps in place on one row.
              // hover is a white overlay (not bg-muted/30, which is invisible
              // against the header band's own white tint)
              className="-mx-1 flex max-w-full grow items-center gap-2.5 rounded px-1 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-md:shrink-0 md:flex-1 motion-reduce:transition-none"
            >
              <ChevronIcon
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none"
                aria-hidden="true"
              />
              {headerTitle}
            </button>
          )}

          {/* Only the ⋮ stays in the title row — the ★ badge lives on the title
            line and Edit/Done sits on the audit line below. */}
          <span className="ml-auto flex shrink-0 items-center gap-2.5">
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    aria-label="More options"
                  >
                    <MoreVertical className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Preferred + Duplicate act on a persisted row, so they're
                  disabled until an unsaved (temp-id) set is first saved. */}
                  <DropdownMenuItem
                    disabled={isNew}
                    onSelect={onTogglePreferred}
                  >
                    {set.isPreferred ? "Unset preferred" : "Set preferred"}
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
            )}
          </span>
        </div>

        {canEdit && (
          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete “{set.name || "this set"}”?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes the whole settings set and everything in it. This
                  can’t be undone.
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

        {/* Description preview — click anywhere to edit. pl-11 aligns it under
          the set name (past the chevron). -mt-1 keeps it grouped with the
          header as a subtitle while leaving a little breathing room; pb-3
          separates it from the body divider below. On mobile the indent is
          dropped entirely — density beats subtitle alignment there. */}
        {showDescription && (
          <div className="-mt-1 pb-1 pl-11 pr-4 max-md:px-0">
            <InlineMarkdownField
              value={set.description}
              canEdit={contentEditable}
              placeholder="Add a short description…"
              compact
              onValueChange={onUpdateDescription}
            />
          </div>
        )}

        {/* Audit line — sits under the description (or directly under the
          header when there is none), same placement on all breakpoints. The
          Edit/Done button rides its right end, off the crowded title row. */}
        <div className="flex items-center gap-2 pb-3 pl-11 pr-4 max-md:px-0 max-md:pb-2">
          <p className="min-w-0 text-xs text-muted-foreground">
            updated by {set.updatedBy} {formatShortDate(set.updatedAt)}
          </p>
          {/* Unsaved-changes marker — ml-auto clusters it (and the Done button
              that follows) at the right end of the audit line, so it reads as
              part of the save affordance. role="status" announces it when edits
              make the set dirty. */}
          {canEdit && isDirty && (
            <span
              role="status"
              className="ml-auto flex shrink-0 items-center gap-1.5 text-sm font-semibold text-warning"
            >
              <span
                className="size-2 rounded-full bg-warning"
                aria-hidden="true"
              />
              Unsaved changes
            </span>
          )}
          {canEdit && (
            <Button
              variant={isEditing || justSaved ? "default" : "ghost"}
              size="sm"
              // Kept focusable while blocked (aria-disabled, not disabled) so AT
              // can announce why Done is unavailable; the click is guarded below.
              // Fixed width: the label cycles Edit → Done → Saving… → Saved! and
              // a width that changes with it makes the row jitter.
              className={cn(
                "h-7 w-20 shrink-0 transition-colors duration-300 motion-reduce:transition-none",
                // The dirty marker (when shown) carries ml-auto and the button
                // follows it; without the marker the button needs ml-auto itself
                // to stay pinned right. Two ml-auto siblings would split the gap.
                !isDirty && "ml-auto",
                blockDone && "opacity-50",
                justSaved &&
                  "bg-success text-success-foreground hover:bg-success/90"
              )}
              aria-disabled={blockDone || isSaving || undefined}
              aria-label={
                blockDone
                  ? "Name the set and all sections before finishing"
                  : isSaving
                    ? "Saving settings set"
                    : undefined
              }
              onClick={(e) => {
                e.stopPropagation();
                if (blockDone || isSaving) return;
                onToggleEdit();
              }}
            >
              {isEditing ? (
                isSaving ? (
                  // No spinner (width cost), but plain static text reads as
                  // nothing happening — pulse the label as the in-flight cue.
                  <span className="animate-pulse motion-reduce:animate-none">
                    Saving…
                  </span>
                ) : (
                  <>
                    <Check aria-hidden="true" />
                    Done
                  </>
                )
              ) : justSaved ? (
                // No icon: with the fixed width, icon + "Saved!" reads crowded.
                "Saved!"
              ) : (
                <>
                  <Pencil aria-hidden="true" />
                  Edit
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded body. Mobile px mirrors the page gutters the Card's negative
          margins removed, so body content keeps its original x-position. */}
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
              {set.sections.map((section) => (
                <SortableSection
                  key={section.id}
                  id={section.id}
                  editing={contentEditable}
                  deleteLabel={`Delete ${describeSection(section)}`}
                  onDelete={() => {
                    onDeleteSection(section.id);
                  }}
                >
                  {renderSection(section)}
                </SortableSection>
              ))}
            </SortableContext>
          </DndContext>

          {set.sections.length === 0 && !contentEditable && (
            <p className="border-t border-outline-variant/60 py-3 text-sm italic text-muted-foreground">
              No settings recorded yet.
            </p>
          )}

          {contentEditable && (
            <AddSectionMenu
              hasSoftware={hasSoftware}
              hasPostPositions={hasPreset("Post positions")}
              hasRubbers={hasPreset("Rubbers")}
              onAdd={onAddSection}
            />
          )}
          {/* Hold the "Add section" row's height (desktop only) so entering
              edit mode doesn't push the next card down. Invisible + inert here;
              the live menu above replaces it once editing. */}
          {reserveEditUi && (
            <div
              className="invisible pointer-events-none max-md:hidden"
              aria-hidden
            >
              <AddSectionMenu
                hasSoftware={hasSoftware}
                hasPostPositions={hasPreset("Post positions")}
                hasRubbers={hasPreset("Rubbers")}
                onAdd={onAddSection}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
