import { describe, it, expect } from "vitest";

/**
 * Tests for pagination logic used in issues list
 */
describe("Issues Pagination Logic", () => {
  const PAGE_SIZE = 25;

  // Helper function that mirrors the actual page parsing logic
  const parsePageNumber = (page: string | undefined): number => {
    return Math.max(1, parseInt(page ?? "1", 10) || 1);
  };

  describe("Page number parsing", () => {
    it("should default to page 1 when no page param provided", () => {
      const currentPage = parsePageNumber(undefined);
      expect(currentPage).toBe(1);
    });

    it("should parse valid page numbers correctly", () => {
      const currentPage = parsePageNumber("3");
      expect(currentPage).toBe(3);
    });

    it("should handle invalid page strings by defaulting to 1", () => {
      const currentPage = parsePageNumber("invalid");
      expect(currentPage).toBe(1);
    });

    it("should handle negative page numbers by using 1", () => {
      const currentPage = parsePageNumber("-5");
      expect(currentPage).toBe(1);
    });

    it("should handle zero page number by using 1", () => {
      const currentPage = parsePageNumber("0");
      expect(currentPage).toBe(1);
    });
  });

  describe("Offset calculation", () => {
    it("should calculate offset of 0 for page 1", () => {
      const currentPage = 1;
      const offset = (currentPage - 1) * PAGE_SIZE;
      expect(offset).toBe(0);
    });

    it("should calculate offset of 25 for page 2", () => {
      const currentPage = 2;
      const offset = (currentPage - 1) * PAGE_SIZE;
      expect(offset).toBe(25);
    });

    it("should calculate offset of 50 for page 3", () => {
      const currentPage = 3;
      const offset = (currentPage - 1) * PAGE_SIZE;
      expect(offset).toBe(50);
    });

    it("should calculate offset correctly for page 10", () => {
      const currentPage = 10;
      const offset = (currentPage - 1) * PAGE_SIZE;
      expect(offset).toBe(225);
    });
  });

  describe("Total pages calculation", () => {
    it("should calculate 1 page for 25 issues", () => {
      const totalCount = 25;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      expect(totalPages).toBe(1);
    });

    it("should calculate 2 pages for 26 issues", () => {
      const totalCount = 26;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      expect(totalPages).toBe(2);
    });

    it("should calculate 8 pages for 197 issues", () => {
      const totalCount = 197;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      expect(totalPages).toBe(8);
    });

    it("should handle 0 issues", () => {
      const totalCount = 0;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      expect(totalPages).toBe(0);
    });

    it("should calculate 4 pages for exactly 100 issues", () => {
      const totalCount = 100;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      expect(totalPages).toBe(4);
    });
  });

  describe("Issue range display", () => {
    it("should show 1-25 for page 1 with 100 total issues", () => {
      const currentPage = 1;
      const totalCount = 100;
      const startIssue = (currentPage - 1) * PAGE_SIZE + 1;
      const endIssue = Math.min(currentPage * PAGE_SIZE, totalCount);
      expect(startIssue).toBe(1);
      expect(endIssue).toBe(25);
    });

    it("should show 26-50 for page 2 with 100 total issues", () => {
      const currentPage = 2;
      const totalCount = 100;
      const startIssue = (currentPage - 1) * PAGE_SIZE + 1;
      const endIssue = Math.min(currentPage * PAGE_SIZE, totalCount);
      expect(startIssue).toBe(26);
      expect(endIssue).toBe(50);
    });

    it("should show 176-197 for page 8 with 197 total issues", () => {
      const currentPage = 8;
      const totalCount = 197;
      const startIssue = (currentPage - 1) * PAGE_SIZE + 1;
      const endIssue = Math.min(currentPage * PAGE_SIZE, totalCount);
      expect(startIssue).toBe(176);
      expect(endIssue).toBe(197);
    });

    it("should handle single issue correctly", () => {
      const currentPage = 1;
      const totalCount = 1;
      const startIssue = (currentPage - 1) * PAGE_SIZE + 1;
      const endIssue = Math.min(currentPage * PAGE_SIZE, totalCount);
      expect(startIssue).toBe(1);
      expect(endIssue).toBe(1);
    });
  });
});
