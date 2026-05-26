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
import { MarkdownSection } from "~/components/machines/settings/MarkdownSection";
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

export type MarkdownField =
  | "description"
  | "rubbers"
  | "postPositions"
  | "notes";

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
  rubbers: ProseMirrorDoc | null;
  postPositions: ProseMirrorDoc | null;
  notes: ProseMirrorDoc | null;
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
  onUpdateField: (field: MarkdownField, value: ProseMirrorDoc | null) => void;
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
}

function formatShortDate(iso: string): string {
  const parts = iso.split("-");
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return iso;
  return `${String(parseInt(m, 10))}/${String(parseInt(d, 10))}`;
}

interface PickerProps {
  hasSoftware: boolean;
  hasDip: boolean;
  onAddSoftware: () => void;
  onAddDipBank: () => void;
}

function SettingsTypePicker({
  hasSoftware,
  hasDip,
  onAddSoftware,
  onAddDipBank,
}: PickerProps): React.JSX.Element | null {
  if (hasSoftware && hasDip) return null;

  // Both empty — show a dropdown with both options. Software settings and DIP
  // switches are two eras of the same thing (game scoring/pricing config), so
  // they share one "Game settings" umbrella — not "hardware" (software isn't).
  if (!hasSoftware && !hasDip) {
    return (
      <div className="py-2.5">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Game settings
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground"
            >
              <Plus aria-hidden="true" />
              Add setting
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onAddSoftware}>
              Software setting
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddDipBank}>
              DIP switch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // One missing — direct button
  return (
    <div className="py-2.5">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={!hasSoftware ? onAddSoftware : onAddDipBank}
      >
        <Plus aria-hidden="true" />
        {!hasSoftware ? "Add software settings" : "Add DIP switches"}
      </Button>
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
  onUpdateField,
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
}: SettingsSetCardProps): React.JSX.Element {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const hasSoftware = set.softwareSettings.length > 0;
  const hasDip = set.dipSwitchBanks.length > 0;
  const nameMissing = set.name.trim() === "";
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
        role="button"
        tabIndex={0}
        className="@container flex cursor-pointer flex-col gap-1 px-4 py-3 hover:bg-muted/30"
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        aria-expanded={isExpanded}
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
            onValueChange={(v) => {
              onUpdateField("description", v);
            }}
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
                onAddBank={onAddDipBank}
                onDeleteBank={onDeleteDipBank}
                onRenameBank={onRenameDipBank}
                onAddSwitch={onAddDipSwitch}
                onUpdateSwitch={onUpdateDipSwitch}
                onDeleteSwitch={onDeleteDipSwitch}
              />
            </div>
          )}

          {contentEditable && (!hasSoftware || !hasDip) && (
            <div className="border-b border-outline-variant/50">
              <SettingsTypePicker
                hasSoftware={hasSoftware}
                hasDip={hasDip}
                onAddSoftware={() => {
                  onAddSoftwareRow();
                }}
                onAddDipBank={() => {
                  onAddDipBank();
                }}
              />
            </div>
          )}

          <div className="border-b border-outline-variant/50">
            <MarkdownSection
              title="Rubbers"
              value={set.rubbers}
              canEdit={contentEditable}
              onValueChange={(v) => {
                onUpdateField("rubbers", v);
              }}
            />
          </div>

          <div className="border-b border-outline-variant/50">
            <MarkdownSection
              title="Post positions"
              value={set.postPositions}
              canEdit={contentEditable}
              onValueChange={(v) => {
                onUpdateField("postPositions", v);
              }}
            />
          </div>

          <MarkdownSection
            title="Notes"
            value={set.notes}
            canEdit={contentEditable}
            onValueChange={(v) => {
              onUpdateField("notes", v);
            }}
          />
        </CardContent>
      )}
    </Card>
  );
}
