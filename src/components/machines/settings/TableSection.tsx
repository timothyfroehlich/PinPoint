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
  reserveEditUi?: boolean;
  onTitleChange?: (newValue: string) => void;
  onAddRow?: () => string | undefined;
  onUpdateRow?: (
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ) => void;
  onDeleteRow?: (rowKey: string) => void;
}

/**
 * A generic three-column (ID / Setting / Value) table under an editable title —
 * the same structure as Software Settings, minus the "Initial Install" baseline
 * strip and software-specific label. For non-software mechanisms (Jones plugs,
 * transformer taps, board jumpers, rotary selectors). Repeatable per set.
 */
export function TableSection({
  title,
  rows,
  canEdit,
  reserveEditUi = false,
  onTitleChange,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}: TableSectionProps): React.JSX.Element {
  const columns = idNameValueColumns(
    (key, field, value) => {
      onUpdateRow?.(key, field, value);
    },
    { idPlaceholder: "ID", idAriaLabel: "Row ID" }
  );

  return (
    <div className="py-2.5 max-md:py-1.5">
      {/* pr-14 in edit mode keeps the title input clear of SortableSection's
          floating grip/delete cluster at the row's right end. */}
      <div className={cn("mb-1.5", canEdit && "pr-14")}>
        <span className={SECTION_TITLE_CLASS}>
          {/* required: a fresh table has no implicit identity (unlike note
              presets), so it opens with the title focused and can't commit
              blank — and the Done guard blocks an untitled table. */}
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
          />
        </span>
      </div>
      {/* Section content hangs indented under the heading so headings read as the structural landmarks. */}
      <div className="pl-2">
        <EditableSettingsTable
          rows={rows}
          columns={columns}
          canEdit={canEdit}
          reserveEditUi={reserveEditUi}
          onAddRow={onAddRow}
          onDeleteRow={onDeleteRow}
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
