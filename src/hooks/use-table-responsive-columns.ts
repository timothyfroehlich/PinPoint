"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";

export interface ColumnConfig {
  key: string;
  minWidth: number;
  priority: number; // Lower = hidden first (1 hides before 2)
}

export interface UseTableResponsiveColumnsReturn<T extends string = string> {
  visibleColumns: Record<T, boolean>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook for adaptive table column visibility based on container width
 *
 * Uses ResizeObserver to hide columns in priority order when container shrinks.
 * Columns with lower priority values are hidden first.
 *
 * @param columns - Array of column configurations with key, minWidth, and priority
 * @param baseWidth - Minimum width required for the base content column
 * @param baseBuffer - Additional buffer space for the base column (default: 50)
 * @returns Object with visibleColumns state and containerRef
 *
 * @example
 * const { visibleColumns, containerRef } = useTableResponsiveColumns(
 *   [
 *     { key: "modified", minWidth: 140, priority: 1 },
 *     { key: "assignee", minWidth: 140, priority: 2 },
 *     { key: "status", minWidth: 120, priority: 5 },
 *   ],
 *   300 // Base width for main content column
 * );
 */
export function useTableResponsiveColumns<T extends string = string>(
  columns: (ColumnConfig & { key: T })[],
  baseWidth: number,
  baseBuffer = 50
): UseTableResponsiveColumnsReturn<T> {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize all columns as visible
  const initialVisibility = columns.reduce(
    (acc, col) => {
      acc[col.key] = true;
      return acc;
    },
    {} as Record<string, boolean>
  );

  const [visibleColumns, setVisibleColumns] =
    useState<Record<string, boolean>>(initialVisibility);

  useEffect(() => {
    if (!containerRef.current) return;

    const calculateLayout = (): void => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      if (width === 0) return;

      // Sort columns by priority (lower = hide first)
      const sortedColumns = [...columns].sort(
        (a, b) => a.priority - b.priority
      );

      // Calculate available width for base column
      let availableBaseWidth = width;
      const nextVisible: Record<string, boolean> = {};

      // Start with all visible
      for (const col of columns) {
        nextVisible[col.key] = true;
      }

      // Calculate total width with all columns visible
      for (const col of columns) {
        availableBaseWidth -= col.minWidth;
      }

      // Hide columns in priority order until base column has enough space
      for (const col of sortedColumns) {
        if (availableBaseWidth < baseWidth + baseBuffer) {
          nextVisible[col.key] = false;
          availableBaseWidth += col.minWidth;
        } else {
          break; // Stop hiding if we have enough space
        }
      }

      setVisibleColumns(nextVisible);
    };

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(calculateLayout);
    });

    calculateLayout();
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [columns, baseWidth, baseBuffer]);

  return {
    visibleColumns,
    containerRef,
  };
}
