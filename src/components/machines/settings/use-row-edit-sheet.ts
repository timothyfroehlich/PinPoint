"use client";

import type React from "react";
import { useRef, useState } from "react";
import { useIsMobile } from "~/hooks/use-is-mobile";

/** Any row the settings tables can edit — identified by a client render key. */
export interface KeyedRow {
  _key: string;
}

/** Props to spread onto a table row that opens the edit sheet when tapped. */
interface MobileRowProps {
  className?: string;
  onClick?: () => void;
}

interface UseRowEditSheetArgs<T extends KeyedRow> {
  /** The current rows, used to resolve the open sheet's row from its key. */
  items: T[];
  canEdit: boolean;
  /** Adds a row and returns its new `_key` (or undefined if the add was a no-op). */
  onAdd?: (() => string | undefined) | undefined;
  onDelete?: ((key: string) => void) | undefined;
}

interface UseRowEditSheetResult<T extends KeyedRow> {
  /** Desktop edit mode: inline cells are editable. Mobile edits via the sheet. */
  rowEditable: boolean;
  /** Freshly-added row that should mount its first inline cell focused (desktop). */
  autoFocusKey: string | null;
  /** Identity of the row whose sheet is open, or null. Pass as RowEditSheet `rowKey`. */
  sheetRowKey: string | null;
  /** The row matching `sheetRowKey`, or null. */
  sheetRow: T | null;
  /** Ref for the always-present Add button — the focus target after a delete. */
  addButtonRef: React.RefObject<HTMLButtonElement | null>;
  /** Add a row, then focus its new inline cell (desktop) or open its sheet (mobile). */
  handleAdd: () => void;
  /** Delete a row, then return focus to the Add button so keyboard users aren't dropped to <body>. */
  handleDelete: (key: string) => void;
  /** Close the edit sheet (wire to RowEditSheet `onOpenChange`). */
  closeSheet: () => void;
  /** Spread onto each table row: opens the sheet on tap, mobile edit mode only. */
  mobileRowProps: (key: string) => MobileRowProps;
}

/**
 * Shared state machine for the Machine Settings tables (Software / generic /
 * DIP bank). Each renders a different set of columns but drives the same
 * editing affordances: inline cell editing on desktop, a per-row bottom sheet
 * on mobile, autofocus on add, and focus recovery on delete. This hook owns
 * that machinery so the three section components only describe their columns
 * and their save mapping.
 */
export function useRowEditSheet<T extends KeyedRow>({
  items,
  canEdit,
  onAdd,
  onDelete,
}: UseRowEditSheetArgs<T>): UseRowEditSheetResult<T> {
  const isMobile = useIsMobile();
  // On mobile, edit mode swaps inline cell editing for a per-row bottom sheet.
  const rowEditable = canEdit && !isMobile;
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);
  const [sheetRowKey, setSheetRowKey] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const sheetRow = items.find((r) => r._key === sheetRowKey) ?? null;

  function handleAdd(): void {
    const newKey = onAdd?.();
    if (!newKey) return;
    // Desktop drops the cursor into the new row's first inline cell; mobile has
    // no inline cells, so open the sheet for the new row instead.
    if (isMobile) {
      setSheetRowKey(newKey);
    } else {
      setAutoFocusKey(newKey);
    }
  }

  function handleDelete(key: string): void {
    onDelete?.(key);
    addButtonRef.current?.focus();
  }

  function closeSheet(): void {
    setSheetRowKey(null);
  }

  function mobileRowProps(key: string): MobileRowProps {
    if (!canEdit || !isMobile) return {};
    return {
      className: "cursor-pointer",
      onClick: () => {
        setSheetRowKey(key);
      },
    };
  }

  return {
    rowEditable,
    autoFocusKey,
    sheetRowKey,
    sheetRow,
    addButtonRef,
    handleAdd,
    handleDelete,
    closeSheet,
    mobileRowProps,
  };
}
