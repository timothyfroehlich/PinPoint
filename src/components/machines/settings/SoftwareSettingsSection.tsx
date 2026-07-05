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
  onBaselineChange?: (newValue: string) => void;
  onAddRow?: () => string | undefined;
  onUpdateRow?: (
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ) => void;
  onDeleteRow?: (rowKey: string) => void;
  /** Called after a row-cell blur so the parent can flush the auto-save debounce. */
  onBlurFlush?: (() => void) | undefined;
}

export function SoftwareSettingsSection({
  baseline,
  rows,
  canEdit,
  onBaselineChange,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onBlurFlush,
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
        {/* Baseline strip: the starting-point preset. */}
        <div className="mb-3 text-sm max-md:mb-2 max-md:text-[13px]">
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-1",
              canEdit && "min-h-8"
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
        </div>

        <EditableSettingsTable
          rows={rows}
          columns={columns}
          canEdit={canEdit}
          onAddRow={onAddRow}
          onDeleteRow={onDeleteRow}
          onBlurFlush={onBlurFlush}
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
