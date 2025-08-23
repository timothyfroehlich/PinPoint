import { describe, it, expect } from "vitest";

import {
  toggleSelection,
  selectAll,
  selectNone,
  isSelected,
  isAllSelected,
  isSomeSelected,
  getSelectedCount,
  getSelectionSummary,
  filterValidSelection,
  toggleSelectAll,
  getStaleSelections,
  batchToggleSelection,
} from "../selectionUtils";

describe("selectionUtils", () => {
  const sampleIds = ["item-1", "item-2", "item-3", "item-4"];

  describe("toggleSelection", () => {
    it("adds item to empty selection when selected=true", () => {
      const result = toggleSelection([], "item-1", true);
      
      expect(result).toEqual(["item-1"]);
    });

    it("adds item to existing selection when selected=true", () => {
      const result = toggleSelection(["item-1"], "item-2", true);
      
      expect(result).toEqual(["item-1", "item-2"]);
    });

    it("does not duplicate item when already selected", () => {
      const result = toggleSelection(["item-1"], "item-1", true);
      
      expect(result).toEqual(["item-1"]);
    });

    it("removes item from selection when selected=false", () => {
      const result = toggleSelection(["item-1", "item-2"], "item-1", false);
      
      expect(result).toEqual(["item-2"]);
    });

    it("does nothing when removing non-existent item", () => {
      const result = toggleSelection(["item-1"], "item-2", false);
      
      expect(result).toEqual(["item-1"]);
    });

    it("preserves order when adding items", () => {
      let selection: string[] = [];
      selection = toggleSelection(selection, "item-3", true);
      selection = toggleSelection(selection, "item-1", true);
      selection = toggleSelection(selection, "item-2", true);
      
      expect(selection).toEqual(["item-3", "item-1", "item-2"]);
    });
  });

  describe("selectAll", () => {
    it("selects all items from list", () => {
      const result = selectAll(sampleIds);
      
      expect(result).toEqual(sampleIds);
    });

    it("returns empty array for empty input", () => {
      const result = selectAll([]);
      
      expect(result).toEqual([]);
    });

    it("creates new array reference", () => {
      const result = selectAll(sampleIds);
      
      expect(result).not.toBe(sampleIds);
      expect(result).toEqual(sampleIds);
    });
  });

  describe("selectNone", () => {
    it("returns empty array", () => {
      const result = selectNone();
      
      expect(result).toEqual([]);
    });

    it("always returns new array reference", () => {
      const result1 = selectNone();
      const result2 = selectNone();
      
      expect(result1).not.toBe(result2);
    });
  });

  describe("isSelected", () => {
    it("returns true for selected item", () => {
      const selection = ["item-1", "item-3"];
      
      expect(isSelected(selection, "item-1")).toBe(true);
      expect(isSelected(selection, "item-3")).toBe(true);
    });

    it("returns false for non-selected item", () => {
      const selection = ["item-1", "item-3"];
      
      expect(isSelected(selection, "item-2")).toBe(false);
      expect(isSelected(selection, "item-4")).toBe(false);
    });

    it("returns false for empty selection", () => {
      expect(isSelected([], "item-1")).toBe(false);
    });
  });

  describe("isAllSelected", () => {
    it("returns true when all items are selected", () => {
      const selection = ["item-1", "item-2", "item-3", "item-4"];
      
      expect(isAllSelected(selection, sampleIds)).toBe(true);
    });

    it("returns false when some items are not selected", () => {
      const selection = ["item-1", "item-3"];
      
      expect(isAllSelected(selection, sampleIds)).toBe(false);
    });

    it("returns false when no items are selected", () => {
      const selection: string[] = [];
      
      expect(isAllSelected(selection, sampleIds)).toBe(false);
    });

    it("returns false for empty available items", () => {
      const selection = ["item-1"];
      
      expect(isAllSelected(selection, [])).toBe(false);
    });

    it("handles selection with extra items not in available list", () => {
      const selection = ["item-1", "item-2", "item-3", "item-4", "extra-item"];
      
      expect(isAllSelected(selection, sampleIds)).toBe(true);
    });
  });

  describe("isSomeSelected", () => {
    it("returns true when some but not all items are selected", () => {
      const selection = ["item-1", "item-3"];
      
      expect(isSomeSelected(selection, sampleIds)).toBe(true);
    });

    it("returns false when all items are selected", () => {
      const selection = ["item-1", "item-2", "item-3", "item-4"];
      
      expect(isSomeSelected(selection, sampleIds)).toBe(false);
    });

    it("returns false when no items are selected", () => {
      const selection: string[] = [];
      
      expect(isSomeSelected(selection, sampleIds)).toBe(false);
    });

    it("returns false for empty available items", () => {
      const selection = ["item-1"];
      
      expect(isSomeSelected(selection, [])).toBe(false);
    });

    it("returns false when selection is empty", () => {
      expect(isSomeSelected([], sampleIds)).toBe(false);
    });
  });

  describe("getSelectedCount", () => {
    it("counts selected items from available list", () => {
      const selection = ["item-1", "item-3"];
      
      expect(getSelectedCount(selection, sampleIds)).toBe(2);
    });

    it("returns 0 for no selections", () => {
      expect(getSelectedCount([], sampleIds)).toBe(0);
    });

    it("ignores selected items not in available list", () => {
      const selection = ["item-1", "item-3", "not-available"];
      
      expect(getSelectedCount(selection, sampleIds)).toBe(2);
    });

    it("returns 0 for empty available items", () => {
      const selection = ["item-1", "item-2"];
      
      expect(getSelectedCount(selection, [])).toBe(0);
    });
  });

  describe("getSelectionSummary", () => {
    it("returns 'None selected' for empty selection", () => {
      const summary = getSelectionSummary([], sampleIds);
      
      expect(summary).toBe("None selected");
    });

    it("returns '1 item selected' for single selection", () => {
      const summary = getSelectionSummary(["item-1"], sampleIds);
      
      expect(summary).toBe("1 item selected");
    });

    it("returns partial selection summary", () => {
      const summary = getSelectionSummary(["item-1", "item-3"], sampleIds);
      
      expect(summary).toBe("2 of 4 items selected");
    });

    it("returns 'All items selected' when everything is selected", () => {
      const summary = getSelectionSummary(sampleIds, sampleIds);
      
      expect(summary).toBe("All 4 items selected");
    });

    it("handles empty available items", () => {
      const summary = getSelectionSummary(["item-1"], []);
      
      expect(summary).toBe("None selected");
    });
  });

  describe("filterValidSelection", () => {
    it("filters out invalid selections", () => {
      const selection = ["item-1", "invalid-item", "item-3", "another-invalid"];
      
      const result = filterValidSelection(selection, sampleIds);
      
      expect(result).toEqual(["item-1", "item-3"]);
    });

    it("keeps all valid selections", () => {
      const selection = ["item-1", "item-3"];
      
      const result = filterValidSelection(selection, sampleIds);
      
      expect(result).toEqual(["item-1", "item-3"]);
    });

    it("returns empty array when no selections are valid", () => {
      const selection = ["invalid-1", "invalid-2"];
      
      const result = filterValidSelection(selection, sampleIds);
      
      expect(result).toEqual([]);
    });

    it("preserves order of valid selections", () => {
      const selection = ["item-3", "invalid", "item-1", "item-2"];
      
      const result = filterValidSelection(selection, sampleIds);
      
      expect(result).toEqual(["item-3", "item-1", "item-2"]);
    });
  });

  describe("toggleSelectAll", () => {
    it("selects all when none are selected", () => {
      const result = toggleSelectAll([], sampleIds);
      
      expect(result).toEqual(sampleIds);
    });

    it("selects all when some are selected", () => {
      const result = toggleSelectAll(["item-1", "item-3"], sampleIds);
      
      expect(result).toEqual(sampleIds);
    });

    it("deselects all when all are selected", () => {
      const result = toggleSelectAll(sampleIds, sampleIds);
      
      expect(result).toEqual([]);
    });

    it("handles extra selections not in available list", () => {
      const currentSelection = ["item-1", "item-2", "item-3", "item-4", "extra-item"];
      
      const result = toggleSelectAll(currentSelection, sampleIds);
      
      expect(result).toEqual([]);
    });
  });

  describe("getStaleSelections", () => {
    it("identifies selections not in available list", () => {
      const selection = ["item-1", "stale-1", "item-3", "stale-2"];
      
      const stale = getStaleSelections(selection, sampleIds);
      
      expect(stale).toEqual(["stale-1", "stale-2"]);
    });

    it("returns empty array when all selections are valid", () => {
      const selection = ["item-1", "item-3"];
      
      const stale = getStaleSelections(selection, sampleIds);
      
      expect(stale).toEqual([]);
    });

    it("returns all selections when none are valid", () => {
      const selection = ["stale-1", "stale-2"];
      
      const stale = getStaleSelections(selection, sampleIds);
      
      expect(stale).toEqual(["stale-1", "stale-2"]);
    });
  });

  describe("batchToggleSelection", () => {
    it("applies multiple toggle operations", () => {
      const operations = [
        { itemId: "item-1", selected: true },
        { itemId: "item-2", selected: true },
        { itemId: "item-3", selected: false },
      ];
      
      const result = batchToggleSelection(["item-3"], operations);
      
      expect(result).toEqual(["item-1", "item-2"]);
    });

    it("handles empty operations list", () => {
      const result = batchToggleSelection(["item-1"], []);
      
      expect(result).toEqual(["item-1"]);
    });

    it("processes operations in order", () => {
      const operations = [
        { itemId: "item-1", selected: true },
        { itemId: "item-1", selected: false }, // Should cancel out the first operation
        { itemId: "item-2", selected: true },
      ];
      
      const result = batchToggleSelection([], operations);
      
      expect(result).toEqual(["item-2"]);
    });

    it("handles complex batch operations", () => {
      const initialSelection = ["item-1", "item-4"];
      const operations = [
        { itemId: "item-1", selected: false }, // Remove item-1
        { itemId: "item-2", selected: true },  // Add item-2
        { itemId: "item-3", selected: true },  // Add item-3
        { itemId: "item-4", selected: true },  // Keep item-4 (already selected)
      ];
      
      const result = batchToggleSelection(initialSelection, operations);
      
      expect(result).toEqual(["item-4", "item-2", "item-3"]);
    });
  });
});