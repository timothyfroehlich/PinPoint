"use client";

import type React from "react";
import { ChevronRight, ChevronDown, Star, MoreVertical } from "lucide-react";
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
import { InlineEditableField } from "~/components/inline-editable-field";
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
  canEdit: boolean;
  onToggleExpand: () => void;
  onTogglePreferred: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdateField: (field: MarkdownField, value: ProseMirrorDoc | null) => void;
  onUpdateBaseline: (newValue: string) => void;
}

function formatShortDate(iso: string): string {
  // "2026-05-12" → "5/12"
  const parts = iso.split("-");
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return iso;
  return `${String(parseInt(m, 10))}/${String(parseInt(d, 10))}`;
}

export function SettingsSetCard({
  set,
  isExpanded,
  canEdit,
  onToggleExpand,
  onTogglePreferred,
  onRename,
  onDuplicate,
  onDelete,
  onUpdateField,
  onUpdateBaseline,
}: SettingsSetCardProps): React.JSX.Element {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

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
        aria-label={`${set.name} settings set`}
      >
        {/* Top row: caret, star, name + updated-by, preferred badge, kebab */}
        <div className="flex items-center gap-2.5">
          <ChevronIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150"
            aria-hidden="true"
          />

          {/* Star toggle */}
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

          {/* Name (click-to-edit) + updated-by */}
          <div className="flex flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <div className="text-sm font-semibold text-foreground">
              <InlineEditableText
                value={set.name}
                onValueChange={onRename}
                canEdit={canEdit}
                placeholder="Untitled set"
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

          {/* Kebab */}
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
        </div>

        {/* Description preview — always visible, click-to-edit */}
        <div
          className="pl-7"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
        >
          <InlineEditableField
            label="Description"
            value={set.description}
            machineId="scaffold-noop"
            canEdit={canEdit}
            placeholder="Add a short description…"
            onSave={(_machineId, newValue) => {
              onUpdateField("description", newValue);
              return Promise.resolve({ ok: true });
            }}
          />
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <CardContent className="border-t border-outline-variant px-4 pb-4 pt-2">
          <div className="border-b border-outline-variant/50">
            <SoftwareSettingsSection
              baseline={set.baseline}
              rows={set.softwareSettings}
              canEdit={canEdit}
              onBaselineChange={onUpdateBaseline}
            />
          </div>

          <div className="border-b border-outline-variant/50">
            <DipSwitchSection banks={set.dipSwitchBanks} canEdit={canEdit} />
          </div>

          <div className="border-b border-outline-variant/50">
            <MarkdownSection
              title="Rubbers"
              value={set.rubbers}
              canEdit={canEdit}
              onValueChange={(v) => {
                onUpdateField("rubbers", v);
              }}
            />
          </div>

          <div className="border-b border-outline-variant/50">
            <MarkdownSection
              title="Post positions"
              value={set.postPositions}
              canEdit={canEdit}
              onValueChange={(v) => {
                onUpdateField("postPositions", v);
              }}
            />
          </div>

          <MarkdownSection
            title="Notes"
            value={set.notes}
            canEdit={canEdit}
            onValueChange={(v) => {
              onUpdateField("notes", v);
            }}
          />
        </CardContent>
      )}
    </Card>
  );
}
