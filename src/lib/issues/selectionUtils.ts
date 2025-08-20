/**
 * Pure business logic for selection management
 * Extracted from IssueList component for proper unit testing
 */

/**
 * Toggles selection state for a single item
 * Pure function - no state side effects
 */
export function toggleSelection(
  currentSelection: string[],
  itemId: string,
  selected: boolean,
): string[] {
  if (selected) {
    // Add to selection if not already present
    return currentSelection.includes(itemId) 
      ? currentSelection 
      : [...currentSelection, itemId];
  } else {
    // Remove from selection
    return currentSelection.filter(id => id !== itemId);
  }
}

/**
 * Selects all items from a list of IDs
 */
export function selectAll(itemIds: string[]): string[] {
  return [...itemIds];
}

/**
 * Clears all selections
 */
export function selectNone(): string[] {
  return [];
}

/**
 * Checks if an item is currently selected
 */
export function isSelected(selection: string[], itemId: string): boolean {
  return selection.includes(itemId);
}

/**
 * Checks if all items are selected
 */
export function isAllSelected(selection: string[], availableIds: string[]): boolean {
  if (availableIds.length === 0) return false;
  return availableIds.every(id => selection.includes(id));
}

/**
 * Checks if some (but not all) items are selected
 */
export function isSomeSelected(selection: string[], availableIds: string[]): boolean {
  if (availableIds.length === 0 || selection.length === 0) return false;
  const selectedCount = availableIds.filter(id => selection.includes(id)).length;
  return selectedCount > 0 && selectedCount < availableIds.length;
}

/**
 * Gets count of selected items from available items
 */
export function getSelectedCount(selection: string[], availableIds: string[]): number {
  return availableIds.filter(id => selection.includes(id)).length;
}

/**
 * Gets human-readable selection summary
 */
export function getSelectionSummary(selection: string[], availableIds: string[]): string {
  const selectedCount = getSelectedCount(selection, availableIds);
  const totalCount = availableIds.length;
  
  if (selectedCount === 0) return "None selected";
  if (selectedCount === 1) return "1 item selected";
  if (selectedCount === totalCount) return `All ${totalCount} items selected`;
  
  return `${selectedCount} of ${totalCount} items selected`;
}

/**
 * Filters a selection to only include valid IDs from available items
 * Useful for cleaning up selection when data changes
 */
export function filterValidSelection(selection: string[], availableIds: string[]): string[] {
  return selection.filter(id => availableIds.includes(id));
}

/**
 * Toggles select all/none based on current state
 * Returns new selection state
 */
export function toggleSelectAll(
  currentSelection: string[], 
  availableIds: string[]
): string[] {
  const allSelected = isAllSelected(currentSelection, availableIds);
  return allSelected ? selectNone() : selectAll(availableIds);
}

/**
 * Gets IDs that are selected but not in the available list
 * Useful for detecting stale selections
 */
export function getStaleSelections(selection: string[], availableIds: string[]): string[] {
  return selection.filter(id => !availableIds.includes(id));
}

/**
 * Batch operations for multiple selections
 */
export function batchToggleSelection(
  currentSelection: string[],
  operations: Array<{ itemId: string; selected: boolean }>
): string[] {
  return operations.reduce(
    (selection, { itemId, selected }) => toggleSelection(selection, itemId, selected),
    currentSelection
  );
}