"use client";

import type React from "react";
import { BaselineCombobox } from "~/components/machines/settings/BaselineCombobox";
import { EditableSettingsTable } from "~/components/machines/settings/EditableSettingsTable";
import { idNameValueColumns } from "~/components/machines/settings/settings-columns";
import { SECTION_TITLE_CLASS } from "~/components/machines/settings/styles";
import { cn } from "~/lib/utils";
import type { SoftwareSetting } from "~/lib/machines/settings-types";

interface SoftwareSettingsSectionProps {
  baseline: string;
  rows: SoftwareSetting[];
  canEdit: boolean;
  reserveEditUi?: boolean;
  onBaselineChange?: (newValue: string) => void;
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
  rows,
  canEdit,
  reserveEditUi = false,
  onBaselineChange,
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
        {/* Baseline strip: the starting-point preset. View and edit share one
          structure (same label font, same row metrics) so toggling Edit doesn't
          reflow. Editors viewing reserve the combobox height at desktop
          (reserveEditUi); the read-only player view stays compact. (How to reach
          the machine's menu now lives in the set-level "How to change settings"
          block at the top of the tab, not per software section.) */}
        <div className="mb-3 text-sm max-md:mb-2 max-md:text-[13px]">
          {/* Label + baseline. min-h-8 matches the combobox so the row keeps its
              height whether the value is plain text or the picker. */}
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
                  // Buffer into the working copy; the section unit's Save
                  // persists it (PP-43q3 atomic per-unit commit).
                  onBaselineChange?.(val);
                }}
              />
            ) : (
              <span className="font-medium text-foreground">
                {baseline || "Not specified"}
              </span>
            )}
          </div>
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
