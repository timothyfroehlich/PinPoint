"use client";

import type React from "react";
import { BaselineCombobox } from "~/components/machines/settings/BaselineCombobox";
import { EditableSettingsTable } from "~/components/machines/settings/EditableSettingsTable";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import { idNameValueColumns } from "~/components/machines/settings/settings-columns";
import { SECTION_TITLE_CLASS } from "~/components/machines/settings/styles";
import { cn } from "~/lib/utils";
import type { SoftwareSetting } from "~/lib/machines/settings-types";

interface SoftwareSettingsSectionProps {
  baseline: string;
  baselineNote: string;
  rows: SoftwareSetting[];
  canEdit: boolean;
  reserveEditUi?: boolean;
  onBaselineChange?: (newValue: string) => void;
  onBaselineNoteChange?: (newValue: string) => void;
  onAddRow?: () => string | undefined;
  onUpdateRow?: (
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ) => void;
  onDeleteRow?: (rowKey: string) => void;
}

export function SoftwareSettingsSection({
  baseline,
  baselineNote,
  rows,
  canEdit,
  reserveEditUi = false,
  onBaselineChange,
  onBaselineNoteChange,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}: SoftwareSettingsSectionProps): React.JSX.Element {
  const columns = idNameValueColumns(
    (key, field, value) => {
      onUpdateRow?.(key, field, value);
    },
    { idPlaceholder: "S-…", idAriaLabel: "Setting ID" }
  );

  return (
    <div className="py-2.5 max-md:py-1.5">
      <p className={cn("mb-1.5", SECTION_TITLE_CLASS)}>Software settings</p>
      {/* Section content hangs indented under the heading so headings read as the structural landmarks. */}
      <div className="pl-2">
        {/* Baseline strip: the starting-point preset + a free-text hint on where
          to find it on the machine. View and edit share one structure (same
          label font, same row metrics) so toggling Edit doesn't reflow. Editors
          viewing reserve the edit controls' height at desktop (reserveEditUi);
          the read-only player view stays compact. */}
        <div className="mb-3 text-sm max-md:mb-2 max-md:text-[13px]">
          {/* Row 1 — label + baseline. min-h-8 matches the combobox so the row
              keeps its height whether the value is plain text or the picker. */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-1",
              canEdit ? "min-h-8" : reserveEditUi && "md:min-h-8"
            )}
          >
            <span className="text-muted-foreground">Initial install:</span>
            {canEdit ? (
              <BaselineCombobox
                value={baseline}
                onChange={(val) => {
                  onBaselineChange?.(val);
                }}
              />
            ) : (
              <span className="font-medium text-foreground">
                {baseline || "Not specified"}
              </span>
            )}
          </div>
          {/* Row 2 — the locating hint on its own line so it never jumps a row
              when toggling modes. The hint is information players came for, so
              it's primary tier (white); only the label stays muted. */}
          {canEdit ? (
            <div className="mt-1">
              <InlineEditableText
                value={baselineNote}
                onValueChange={(v) => {
                  onBaselineNoteChange?.(v);
                }}
                canEdit
                placeholder="Add instructions for finding it"
                ariaLabel="Where to find this setting"
                inputClassName="h-8 text-sm"
              />
            </div>
          ) : baselineNote ? (
            <p className="mt-1 text-foreground">{baselineNote}</p>
          ) : reserveEditUi ? (
            // Editor viewing with no hint yet: hold the line's height (desktop)
            // so entering edit doesn't push the table down.
            <p className="mt-1 hidden md:block" aria-hidden>
              &nbsp;
            </p>
          ) : null}
        </div>

        <EditableSettingsTable
          rows={rows}
          columns={columns}
          canEdit={canEdit}
          reserveEditUi={reserveEditUi}
          onAddRow={onAddRow}
          onDeleteRow={onDeleteRow}
          tableAriaLabel="Software settings"
          addLabel="Add row"
          deleteAriaLabel={(row) =>
            `Delete software setting ${row.id || "row"}`
          }
          sheetTitle="Edit setting"
          sheetSubtitle="Software settings"
        />
      </div>
    </div>
  );
}
