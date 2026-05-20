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
import { MarkdownSection } from "~/components/machines/settings/MarkdownSection";
import {
  SoftwareSettingsSection,
  type SoftwareSetting,
} from "~/components/machines/settings/SoftwareSettingsSection";
import {
  DipSwitchSection,
  type DipSwitch,
} from "~/components/machines/settings/DipSwitchSection";

export interface SettingsSetData {
  id: string;
  name: string;
  isPreferred: boolean;
  updatedBy: string;
  updatedAt: string;
  description: string;
  baseline: { group: string; value: string };
  softwareSettings: SoftwareSetting[];
  dipSwitches: DipSwitch[];
  rubbers: string;
  postPositions: string;
  notes: string;
}

interface SettingsSetCardProps {
  set: SettingsSetData;
  isExpanded: boolean;
  canEdit: boolean;
  onToggleExpand: () => void;
  onTogglePreferred: () => void;
}

function formatMetaWhenCollapsed(set: SettingsSetData): string {
  const sw = set.softwareSettings.length;
  const dip = set.dipSwitches.length;
  const swLabel =
    sw === 0
      ? "no software settings"
      : `${String(sw)} software setting${sw !== 1 ? "s" : ""}`;
  const dipLabel =
    dip === 0
      ? "no dip switches"
      : `${String(dip)} dip switch${dip !== 1 ? "es" : ""}`;
  return `updated ${set.updatedAt} by ${set.updatedBy} · ${swLabel} · ${dipLabel}`;
}

export function SettingsSetCard({
  set,
  isExpanded,
  canEdit,
  onToggleExpand,
  onTogglePreferred,
}: SettingsSetCardProps): React.JSX.Element {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors duration-150",
        set.isPreferred
          ? "border-warning/40 ring-1 ring-warning/30"
          : "border-outline-variant"
      )}
    >
      {/* Header row — always visible */}
      <div
        role="button"
        tabIndex={0}
        className="flex cursor-pointer items-center gap-2.5 px-4 py-3 hover:bg-muted/30"
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`${set.name} settings set`}
      >
        {/* Chevron */}
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

        {/* Set name */}
        <span className="flex-1 text-sm font-semibold text-foreground">
          {set.name}
        </span>

        {/* Preferred pill — only when preferred */}
        {set.isPreferred && (
          <Badge
            className="shrink-0 border-warning/30 bg-warning/10 text-warning"
            variant="outline"
          >
            ★ Preferred
          </Badge>
        )}

        {/* Collapsed meta string */}
        {!isExpanded && (
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
            {formatMetaWhenCollapsed(set)}
          </span>
        )}

        {/* Kebab menu */}
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
            <DropdownMenuItem
              onSelect={() => {
                /* no-op scaffold */
              }}
            >
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                /* no-op scaffold */
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <CardContent className="border-t border-outline-variant px-4 pb-4 pt-0">
          {/* Meta strip */}
          <p className="border-b border-dashed border-outline-variant/50 py-2.5 text-xs text-muted-foreground">
            Updated by{" "}
            <strong className="font-medium text-foreground">
              {set.updatedBy}
            </strong>{" "}
            on {set.updatedAt}
            <span className="mx-1.5 text-outline-variant">·</span>
            {String(set.softwareSettings.length)} software setting
            {set.softwareSettings.length !== 1 ? "s" : ""}
            <span className="mx-1.5 text-outline-variant">·</span>
            {set.dipSwitches.length === 0
              ? "no dip switches"
              : `${String(set.dipSwitches.length)} dip switch${set.dipSwitches.length !== 1 ? "es" : ""}`}
          </p>

          {/* Description */}
          <div className="border-b border-outline-variant/50">
            <MarkdownSection
              title="Description"
              value={set.description}
              canEdit={canEdit}
            />
          </div>

          {/* Software settings */}
          <div className="border-b border-outline-variant/50">
            <SoftwareSettingsSection
              baseline={set.baseline}
              rows={set.softwareSettings}
              canEdit={canEdit}
            />
          </div>

          {/* Dip switches */}
          <div className="border-b border-outline-variant/50">
            <DipSwitchSection rows={set.dipSwitches} canEdit={canEdit} />
          </div>

          {/* Rubbers */}
          <div className="border-b border-outline-variant/50">
            <MarkdownSection
              title="Rubbers"
              value={set.rubbers}
              canEdit={canEdit}
            />
          </div>

          {/* Post positions */}
          <div className="border-b border-outline-variant/50">
            <MarkdownSection
              title="Post positions"
              value={set.postPositions}
              canEdit={canEdit}
            />
          </div>

          {/* Notes */}
          <MarkdownSection title="Notes" value={set.notes} canEdit={canEdit} />
        </CardContent>
      )}
    </Card>
  );
}
