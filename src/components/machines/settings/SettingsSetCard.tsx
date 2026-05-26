"use client";

import type React from "react";
import {
  ChevronRight,
  ChevronDown,
  Star,
  MoreVertical,
  Plus,
  Pencil,
  Check,
} from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import {
  NoteSection,
  type NoteSectionData,
} from "~/components/machines/settings/NoteSection";
import {
  SoftwareSettingsSection,
  type SoftwareSetting,
} from "~/components/machines/settings/SoftwareSettingsSection";
import {
  DipSwitchSection,
  type DipSwitchBank,
} from "~/components/machines/settings/DipSwitchSection";
import { InlineMarkdownField } from "~/components/machines/settings/InlineMarkdownField";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

// Preset note titles that may appear at most once per set.
export const PRESET_NOTE_TITLES = ["Post positions", "Rubbers"] as const;

export interface SettingsSetData {
  id: string;
  name: string;
  isPreferred: boolean;
  updatedBy: string;
  updatedAt: string;
  description: ProseMirrorDoc | null;
  baseline: string;
  softwareSettings: SoftwareSetting[];
  dipSwitchBanks: DipSwitchBank[];
  notes: NoteSectionData[];
}

interface SettingsSetCardProps {
  set: SettingsSetData;
  isExpanded: boolean;
  /** Permission to edit at all (owner/tech+). Governs the Edit button,
   *  the kebab, and the Preferred star. */
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
  onUpdateBaseline: (newValue: string) => void;
  // Software settings rows
  onAddSoftwareRow: () => string | undefined;
  onUpdateSoftwareRow: (
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ) => void;
  onDeleteSoftwareRow: (rowKey: string) => void;
  // DIP switches
  onAddDipBank: () => { bankId: string; switchKey: string } | undefined;
  onDeleteDipBank: (bankId: string) => void;
  onRenameDipBank: (bankId: string, name: string) => void;
  onAddDipSwitch: (bankId: string) => string | undefined;
  onUpdateDipSwitch: (
    bankId: string,
    switchKey: string,
    field: "switch" | "position" | "note",
    value: string
  ) => void;
  onDeleteDipSwitch: (bankId: string, switchKey: string) => void;
  // Free-form note sections
  onAddNote: (title: string, customTitle: boolean) => void;
  onUpdateNoteTitle: (noteId: string, title: string) => void;
  onUpdateNoteBody: (noteId: string, body: ProseMirrorDoc | null) => void;
  onDeleteNote: (noteId: string) => void;
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
  onAddSoftware: () => void;
  onAddDipBank: () => void;
  onAddNote: (title: string, customTitle: boolean) => void;
}

/**
 * The single "Add…" entry point for a set. Surfaces every kind of content a
 * set can hold — software settings, a DIP bank, the Post positions / Rubbers
 * presets, or a custom Other/Notes section. Single-instance kinds (software,
 * the two presets) drop off the menu once present; DIP banks and Other/Notes
 * repeat, so the menu is never empty.
 */
function AddSectionMenu({
  hasSoftware,
  hasPostPositions,
  hasRubbers,
  onAddSoftware,
  onAddDipBank,
  onAddNote,
}: AddSectionMenuProps): React.JSX.Element {
  return (
    <div className="py-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-muted-foreground">
            <Plus aria-hidden="true" />
            Add…
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {!hasSoftware && (
            <DropdownMenuItem onSelect={onAddSoftware}>
              Software settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onAddDipBank}>
            DIP switch
          </DropdownMenuItem>
          {!hasPostPositions && (
            <DropdownMenuItem
              onSelect={() => {
                onAddNote("Post positions", false);
              }}
            >
              Post positions
            </DropdownMenuItem>
          )}
          {!hasRubbers && (
            <DropdownMenuItem
              onSelect={() => {
                onAddNote("Rubbers", false);
              }}
            >
              Rubbers
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              // Blank title → the new section opens with its title field
              // focused so the user names it, rather than defaulting to "Notes".
              onAddNote("", true);
            }}
          >
            Other / Notes…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
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
  onUpdateBaseline,
  onAddSoftwareRow,
  onUpdateSoftwareRow,
  onDeleteSoftwareRow,
  onAddDipBank,
  onDeleteDipBank,
  onRenameDipBank,
  onAddDipSwitch,
  onUpdateDipSwitch,
  onDeleteDipSwitch,
  onAddNote,
  onUpdateNoteTitle,
  onUpdateNoteBody,
  onDeleteNote,
}: SettingsSetCardProps): React.JSX.Element {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const hasSoftware = set.softwareSettings.length > 0;
  const hasDip = set.dipSwitchBanks.length > 0;
  const nameMissing = set.name.trim() === "";
  const hasPreset = (title: string): boolean =>
    set.notes.some((n) => !n.customTitle && n.title === title);
  // Content edits (name, description, cells, baseline, add/delete) unlock
  // only when this set is in edit mode. Set-level ops (star, kebab) use
  // canEdit directly.
  const contentEditable = canEdit && isEditing;

  function handleDelete(): void {
    const ok = window.confirm(`Delete "${set.name}"? This can't be undone.`);
    if (ok) onDelete();
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors duration-150",
        set.isPreferred
          ? "border-warning/40 ring-1 ring-warning/30"
          : "border-outline-variant"
      )}
    >
      {/* Header block — always visible */}
      <div
        // While editing, the header is inert — no collapse-on-click, so a
        // mis-aimed click on a field can't fold the card shut mid-edit.
        role={isEditing ? undefined : "button"}
        tabIndex={isEditing ? undefined : 0}
        className={cn(
          "@container flex flex-col gap-1 px-4 py-3",
          !isEditing && "cursor-pointer hover:bg-muted/30"
        )}
        onClick={isEditing ? undefined : onToggleExpand}
        onKeyDown={
          isEditing
            ? undefined
            : (e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleExpand();
                }
              }
        }
        aria-expanded={isEditing ? undefined : isExpanded}
        aria-label={`${set.name || "Unnamed"} settings set`}
      >
        {/* Top row */}
        <div className="flex items-center gap-2.5">
          <ChevronIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150"
            aria-hidden="true"
          />

          {canEdit ? (
            <button
              type="button"
              aria-label={
                set.isPreferred
                  ? "Preferred set (click to unset)"
                  : "Make this the preferred set"
              }
              className="shrink-0 rounded p-0.5 transition-colors duration-150 hover:bg-muted/50"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePreferred();
              }}
            >
              <Star
                className={cn(
                  "size-4 transition-colors duration-150",
                  set.isPreferred
                    ? "fill-warning text-warning"
                    : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
            </button>
          ) : (
            // View mode: static indicator. Only render for the preferred set
            // so non-preferred cards aren't cluttered with empty stars.
            set.isPreferred && (
              <Star
                className="size-4 shrink-0 fill-warning text-warning"
                aria-label="Preferred set"
              />
            )
          )}

          <div className="flex flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <div className="text-sm font-semibold text-foreground">
              <InlineEditableText
                value={set.name}
                onValueChange={onRename}
                canEdit={contentEditable}
                required
                placeholder="Name this set"
                ariaLabel="set name"
                inputClassName="h-7 text-sm font-semibold"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              updated by {set.updatedBy} {formatShortDate(set.updatedAt)}
            </span>
          </div>

          {set.isPreferred && (
            <Badge
              className="shrink-0 border-warning/30 bg-warning/10 text-warning"
              variant="outline"
            >
              ★ Preferred
            </Badge>
          )}

          {canEdit && (
            <Button
              variant={isEditing ? "default" : "ghost"}
              size="sm"
              className="h-7 shrink-0"
              // A set must have a name before edit mode can be left.
              disabled={isEditing && nameMissing}
              aria-label={
                isEditing && nameMissing
                  ? "Name the set before finishing"
                  : undefined
              }
              onClick={(e) => {
                e.stopPropagation();
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
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MoreVertical className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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

        {/* Description preview — always visible, click anywhere to edit */}
        <div className="pl-7">
          <InlineMarkdownField
            value={set.description}
            canEdit={contentEditable}
            placeholder="Add a short description…"
            compact
            onValueChange={onUpdateDescription}
          />
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <CardContent className="border-t border-outline-variant px-4 pb-4 pt-2">
          {hasSoftware && (
            <div className="border-b border-outline-variant/50">
              <SoftwareSettingsSection
                baseline={set.baseline}
                rows={set.softwareSettings}
                canEdit={contentEditable}
                onBaselineChange={onUpdateBaseline}
                onAddRow={onAddSoftwareRow}
                onUpdateRow={onUpdateSoftwareRow}
                onDeleteRow={onDeleteSoftwareRow}
              />
            </div>
          )}

          {hasDip && (
            <div className="border-b border-outline-variant/50">
              <DipSwitchSection
                banks={set.dipSwitchBanks}
                canEdit={contentEditable}
                onDeleteBank={onDeleteDipBank}
                onRenameBank={onRenameDipBank}
                onAddSwitch={onAddDipSwitch}
                onUpdateSwitch={onUpdateDipSwitch}
                onDeleteSwitch={onDeleteDipSwitch}
              />
            </div>
          )}

          {set.notes.map((note) => (
            <div key={note.id} className="border-b border-outline-variant/50">
              <NoteSection
                note={note}
                canEdit={contentEditable}
                onTitleChange={(title) => {
                  onUpdateNoteTitle(note.id, title);
                }}
                onBodyChange={(body) => {
                  onUpdateNoteBody(note.id, body);
                }}
                onDelete={() => {
                  onDeleteNote(note.id);
                }}
              />
            </div>
          ))}

          {contentEditable && (
            <AddSectionMenu
              hasSoftware={hasSoftware}
              hasPostPositions={hasPreset("Post positions")}
              hasRubbers={hasPreset("Rubbers")}
              onAddSoftware={() => {
                onAddSoftwareRow();
              }}
              onAddDipBank={() => {
                onAddDipBank();
              }}
              onAddNote={onAddNote}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}
