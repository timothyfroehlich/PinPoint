"use client";

import type React from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ConfirmingDeleteButton } from "~/components/machines/settings/ConfirmingDeleteButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { EditableCell } from "~/components/machines/settings/EditableCell";
import { RowEditSheet } from "~/components/machines/settings/RowEditSheet";
import {
  type KeyedRow,
  useRowEditSheet,
} from "~/components/machines/settings/use-row-edit-sheet";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

/**
 * One column of an editable settings table. The column owns how its value is
 * read from a row, how an edit commits back, and how the cell + header look —
 * so the table itself stays schema-agnostic.
 */
export interface SettingsTableColumn<T extends KeyedRow> {
  /** Stable field identity, also the RowEditSheet field key. */
  key: string;
  /** Column header text, reused as the sheet field label. */
  header: string;
  /**
   * "text" → click-to-edit cell (desktop) / sheet text input (mobile).
   * "toggle" → in-table Switch storing the literal strings "ON"/"OFF".
   */
  kind: "text" | "toggle";
  read: (row: T) => string;
  commit: (row: T, value: string) => void;
  /** Render the value in a monospace font (IDs, switch numbers). */
  mono?: boolean;
  /** Placeholder shown in the empty editor (text columns only). */
  placeholder?: string;
  /** Accessible name for the cell control; a function when it needs the row. */
  ariaLabel: string | ((row: T) => string);
  headClassName: string;
  cellClassName: string;
}

interface EditableSettingsTableProps<T extends KeyedRow> {
  rows: T[];
  columns: SettingsTableColumn<T>[];
  canEdit: boolean;
  /** Editor viewing this set (has permission, not currently editing): reserve
   *  the edit affordances' space at desktop widths so entering edit doesn't
   *  reflow the page. No effect for read-only viewers or on mobile. */
  reserveEditUi?: boolean;
  onAddRow?: (() => string | undefined) | undefined;
  onDeleteRow?: ((key: string) => void) | undefined;
  tableAriaLabel: string;
  addLabel: string;
  deleteAriaLabel: (row: T) => string;
  sheetTitle: string;
  sheetSubtitle: string;
  /** Rendered in place of the table when there are no rows (e.g. an empty DIP bank). */
  emptyState?: React.ReactNode;
}

function ariaFor<T>(label: string | ((row: T) => string), row: T): string {
  return typeof label === "function" ? label(row) : label;
}

/**
 * The shared editable table behind every Machine Settings table (Software,
 * generic, DIP bank). Columns describe the schema; this component owns the
 * common affordances: inline cell editing on desktop, a per-row bottom sheet on
 * mobile (tap a row to open it), autofocus into a freshly-added row, focus
 * recovery after delete, and the "+ Add" control. A section only supplies its
 * heading and a column spec.
 */
export function EditableSettingsTable<T extends KeyedRow>({
  rows,
  columns,
  canEdit,
  reserveEditUi = false,
  onAddRow,
  onDeleteRow,
  tableAriaLabel,
  addLabel,
  deleteAriaLabel,
  sheetTitle,
  sheetSubtitle,
  emptyState,
}: EditableSettingsTableProps<T>): React.JSX.Element {
  const {
    rowEditable,
    autoFocusKey,
    sheetRowKey,
    sheetRow,
    addButtonRef,
    handleAdd,
    handleDelete,
    closeSheet,
    mobileRowProps,
  } = useRowEditSheet({
    items: rows,
    canEdit,
    onAdd: onAddRow,
    onDelete: onDeleteRow,
  });

  function handleSheetSave(values: Record<string, string>): void {
    if (!sheetRow) return;
    for (const col of columns) {
      const raw = values[col.key] ?? "";
      const next = col.kind === "toggle" ? (raw === "ON" ? "ON" : "OFF") : raw;
      if (next !== col.read(sheetRow)) col.commit(sheetRow, next);
    }
  }

  return (
    <>
      {rows.length === 0 && emptyState ? (
        emptyState
      ) : (
        // table-fixed on desktop so column widths come from the header's width
        // classes, not content: ID/Switch keeps its fixed width and the
        // Setting/Value pair splits the remaining space ~67/33.
        <Table aria-label={tableAriaLabel} className="md:table-fixed">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  scope="col"
                  className={col.headClassName}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row._key} {...mobileRowProps(row._key)}>
                {columns.map((col, colIndex) => {
                  const isLast = colIndex === columns.length - 1;
                  return (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.cellClassName,
                        // The row delete is an overlay in the last cell — no
                        // separate column, so the data columns never shift when
                        // edit mode turns on. Reserve its room with right
                        // padding: always while editing, and at desktop widths
                        // when an editor is merely viewing (so Edit doesn't
                        // re-wrap the value column).
                        isLast && "relative",
                        isLast && canEdit && "pr-8",
                        isLast && !canEdit && reserveEditUi && "md:pr-8"
                      )}
                    >
                      {col.kind === "toggle" ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={col.read(row) === "ON"}
                            // Mobile edits in the sheet, so the in-table toggle is
                            // disabled there. pointer-events-none lets the tap fall
                            // through to the row onClick (opening the sheet) instead
                            // of dying on the disabled button; desktop stays live.
                            disabled={!rowEditable}
                            className={cn(
                              !rowEditable && "pointer-events-none"
                            )}
                            onCheckedChange={(checked) => {
                              col.commit(row, checked ? "ON" : "OFF");
                            }}
                            aria-label={ariaFor(col.ariaLabel, row)}
                          />
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {col.read(row)}
                          </span>
                        </div>
                      ) : (
                        <EditableCell
                          value={col.read(row)}
                          canEdit={rowEditable}
                          onCommit={(v) => {
                            col.commit(row, v);
                          }}
                          autoFocusOnMount={
                            colIndex === 0 && row._key === autoFocusKey
                          }
                          placeholder={col.placeholder ?? "—"}
                          ariaLabel={ariaFor(col.ariaLabel, row)}
                          inputClassName={col.mono ? "font-mono" : ""}
                        />
                      )}
                      {isLast && canEdit && (
                        <ConfirmingDeleteButton
                          ariaLabel={deleteAriaLabel(row)}
                          onConfirmedDelete={() => {
                            handleDelete(row._key);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                        />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {(canEdit || reserveEditUi) && (
        // When an editor is only viewing, the button is held invisible at
        // desktop widths so its row is reserved — clicking Edit then reveals it
        // in place instead of pushing the rest of the card down. Hidden on
        // mobile (no reservation there) and absent entirely for read-only users.
        <Button
          ref={addButtonRef}
          variant="ghost"
          size="sm"
          className={cn(
            "mt-1 text-muted-foreground",
            !canEdit && "invisible pointer-events-none max-md:hidden"
          )}
          onClick={handleAdd}
          {...(!canEdit ? { tabIndex: -1, "aria-hidden": true } : {})}
        >
          <Plus aria-hidden="true" />
          {addLabel}
        </Button>
      )}

      <RowEditSheet
        open={sheetRow !== null}
        onOpenChange={(o) => {
          if (!o) closeSheet();
        }}
        title={sheetTitle}
        subtitle={sheetSubtitle}
        rowKey={sheetRowKey}
        fields={
          sheetRow
            ? columns.map((col) => ({
                key: col.key,
                label: col.header,
                value: col.read(sheetRow),
                mono: col.mono ?? false,
                kind: col.kind,
              }))
            : []
        }
        onSave={handleSheetSave}
      />
    </>
  );
}
