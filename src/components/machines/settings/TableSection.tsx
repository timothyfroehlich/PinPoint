"use client";

import type React from "react";
import { EditableSettingsTable } from "~/components/machines/settings/EditableSettingsTable";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import { idNameValueColumns } from "~/components/machines/settings/settings-columns";
import { SECTION_TITLE_CLASS } from "~/components/machines/settings/styles";
import { cn } from "~/lib/utils";
import type { SoftwareSetting } from "~/lib/machines/settings-types";

interface TableSectionProps {
  title: string;
  rows: SoftwareSetting[];
  canEdit: boolean;
  onTitleChange?: (newValue: string) => void;
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

/**
 * A generic three-column (ID / Setting / Value) table under an always-live
 * editable title — the same structure as Software Settings, minus the "Initial
 * Install" baseline strip and software-specific label. For non-software
 * mechanisms (Jones plugs, transformer taps, board jumpers, rotary selectors).
 * Repeatable per set.
 */
export function TableSection({
  title,
  rows,
  canEdit,
  onTitleChange,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onBlurFlush,
}: TableSectionProps): React.JSX.Element {
  const columns = idNameValueColumns(
    (key, field, value) => {
      onUpdateRow?.(key, field, value);
    },
    { idPlaceholder: "ID", idAriaLabel: "Row ID" }
  );

  return (
    <div className="py-2.5 max-md:py-1.5">
      {/* pr-14 keeps the title input clear of SortableSection's floating
          grip/kebab cluster at the row's right end. */}
      <div className={cn("mb-1.5", canEdit && "pr-14")}>
        <span className={SECTION_TITLE_CLASS}>
          {/* required: a fresh table has no implicit identity (unlike note
              presets), so it can't commit blank — the empty-name guard in
              SettingsTab blocks an untitled table from being saved. */}
          <InlineEditableText
            value={title}
            canEdit={canEdit}
            required
            onValueChange={(v) => {
              onTitleChange?.(v);
            }}
            placeholder="Table name"
            ariaLabel="table name"
            inputClassName="h-7 text-sm font-semibold"
            onBlurCommit={onBlurFlush}
          />
        </span>
      </div>
      {/* Section content hangs indented under the heading. */}
      <div className="pl-2">
        <EditableSettingsTable
          rows={rows}
          columns={columns}
          canEdit={canEdit}
          onAddRow={onAddRow}
          onDeleteRow={onDeleteRow}
          onBlurFlush={onBlurFlush}
          tableAriaLabel={`${title || "Other settings"} table`}
          addLabel="Add row"
          deleteAriaLabel={(row) => `Delete row ${row.id || "row"}`}
          sheetTitle="Edit setting"
          sheetSubtitle={title || "Table"}
        />
      </div>
    </div>
  );
}
