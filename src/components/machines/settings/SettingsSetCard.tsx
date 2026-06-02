"use client";

import type React from "react";
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
    <div className="border-t border-outline-variant/60 py-2.5">
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
    case "dip":
      return `the ${section.name || "DIP"} bank`;
    case "note":
      return `the ${section.title || "untitled"} section`;
  }
}

function sectionHasContent(section: SettingsSection): boolean {
  switch (section.kind) {
    case "software":
      return section.rows.some((r) => r.id || r.name || r.value);
    case "dip":
      return section.switches.some((s) => s.switch || s.note);
    case "note":
      return (
        section.title.trim() !== "" ||
        (section.body !== null && docToPlainText(section.body).trim() !== "")
      );
  }
}

export function SettingsSetCard({
  set,
  isExpanded,
  canEdit,
  isEditing,
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
  onRenameDipBank,
  onAddDipSwitch,
  onUpdateDipSwitch,
  onDeleteDipSwitch,
  onUpdateNoteTitle,
  onUpdateNoteBody,
}: SettingsSetCardProps): React.JSX.Element {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const nameMissing = set.name.trim() === "";
  // A custom (Other/Notes) section must be titled before edit mode can be
  // left — presets carry fixed titles, so only custom ones can be blank.
  const sectionTitleMissing = set.sections.some(
    (s) => s.kind === "note" && s.customTitle && s.title.trim() === ""
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

  function handleDelete(): void {
    const ok = window.confirm(`Delete "${set.name}"? This can't be undone.`);
    if (ok) onDelete();
  }

  function confirmDeleteSection(section: SettingsSection): void {
    if (sectionHasContent(section)) {
      const ok = window.confirm(
        `Delete ${describeSection(section)}? This can't be undone.`
      );
      if (!ok) return;
    }
    onDeleteSection(section.id);
  }

  function renderSection(section: SettingsSection): React.JSX.Element {
    switch (section.kind) {
      case "software":
        return (
          <SoftwareSettingsSection
            baseline={section.baseline}
            baselineNote={section.baselineNote}
            rows={section.rows}
            canEdit={contentEditable}
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
      case "dip":
        return (
          <DipBankSection
            bank={section}
            canEdit={contentEditable}
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

  // Name + meta, shared by both header modes. The name is editable only in
  // edit mode (otherwise InlineEditableText renders plain text — safe to nest
  // inside the view-mode toggle <button>).
  const headerTitle = (
    // Spans (not divs) so this can live inside the view-mode <button> without
    // invalid <div>-in-<button> nesting.
    <span className="flex flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <span className="text-sm font-semibold text-foreground">
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
      <span className="text-xs text-muted-foreground">
        updated by {set.updatedBy} {formatShortDate(set.updatedAt)}
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
        set.isPreferred
          ? "border-warning/40 ring-1 ring-warning/30"
          : "border-outline-variant"
      )}
    >
      {/* Header block — always visible */}
      <div className="flex items-center gap-2.5 px-4 py-3">
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
            className="-mx-1 flex flex-1 items-center gap-2.5 rounded px-1 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <ChevronIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none"
              aria-hidden="true"
            />
            {headerTitle}
          </button>
        )}

        {set.isPreferred && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">
                <Badge
                  className="border-warning/30 bg-warning/10 text-warning"
                  variant="outline"
                >
                  ★ Preferred
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {canEdit
                ? "Preferred set — change in the ⋮ menu"
                : "Preferred set"}
            </TooltipContent>
          </Tooltip>
        )}

        {canEdit && (
          <Button
            variant={isEditing ? "default" : "ghost"}
            size="sm"
            // Kept focusable while blocked (aria-disabled, not disabled) so AT
            // can announce why Done is unavailable; the click is guarded below.
            className={cn("h-7 shrink-0", blockDone && "opacity-50")}
            aria-disabled={blockDone || undefined}
            aria-label={
              blockDone
                ? "Name the set and all sections before finishing"
                : undefined
            }
            onClick={(e) => {
              e.stopPropagation();
              if (blockDone) return;
              onToggleEdit();
            }}
          >
            {isEditing ? (
              <>
                <Check aria-hidden="true" />
                Done
              </>
            ) : (
              <>
                <Pencil aria-hidden="true" />
                Edit
              </>
            )}
          </Button>
        )}

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
              <DropdownMenuItem onSelect={onTogglePreferred}>
                {set.isPreferred ? "Unset preferred" : "Set preferred"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDuplicate}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={handleDelete}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Description preview — click anywhere to edit. pl-11 aligns it under
          the set name (past the chevron). -mt-1 keeps it grouped with the
          header as a subtitle while leaving a little breathing room; pb-3
          separates it from the body divider below. */}
      {showDescription && (
        <div className="-mt-1 pb-3 pl-11 pr-4">
          <InlineMarkdownField
            value={set.description}
            canEdit={contentEditable}
            placeholder="Add a short description…"
            compact
            onValueChange={onUpdateDescription}
          />
        </div>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-0">
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
                    confirmDeleteSection(section);
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
        </CardContent>
      )}
    </Card>
  );
}
