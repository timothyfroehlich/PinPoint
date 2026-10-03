import { describe, it, expect } from "vitest";
import { parseIssueFilters, hasActiveIssueFilters } from "~/lib/issues/filters";
import { machineIssuesHref } from "~/lib/issues/links";

describe("parseIssueFilters", () => {
  it("parses search query", () => {
    const params = new URLSearchParams("q=flipper");
    const filters = parseIssueFilters(params);
    expect(filters.q).toBe("flipper");
  });

  it("parses comma-separated status values", () => {
    const params = new URLSearchParams("status=new,confirmed");
    const filters = parseIssueFilters(params);
    expect(filters.status).toEqual(["new", "confirmed"]);
  });

  it("filters out invalid status values", () => {
    const params = new URLSearchParams("status=new,invalid_status,confirmed");
    const filters = parseIssueFilters(params);
    expect(filters.status).toEqual(["new", "confirmed"]);
  });

  it("parses machine initials", () => {
    const params = new URLSearchParams("machine=AFM,TZ");
    const filters = parseIssueFilters(params);
    expect(filters.machine).toEqual(["AFM", "TZ"]);
  });

  it("parses severity and priority", () => {
    const params = new URLSearchParams("severity=major&priority=high");
    const filters = parseIssueFilters(params);
    expect(filters.severity).toEqual(["major"]);
    expect(filters.priority).toEqual(["high"]);
  });

  it("parses date range correctly", () => {
    const params = new URLSearchParams(
      "created_from=2026-01-01&created_to=2026-01-31"
    );
    const filters = parseIssueFilters(params);
    expect(filters.createdFrom?.toISOString()).toContain("2026-01-01");
    expect(filters.createdTo?.toISOString()).toContain("2026-01-31");
  });

  it("handles pagination parameters", () => {
    const params = new URLSearchParams("page=2&page_size=25");
    const filters = parseIssueFilters(params);
    expect(filters.page).toBe(2);
    expect(filters.pageSize).toBe(25);
  });

  it("defaults pagination parameters", () => {
    const params = new URLSearchParams("");
    const filters = parseIssueFilters(params);
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(15);
    expect(filters.status).toBeUndefined();
  });

  it("handles status=all", () => {
    const params = new URLSearchParams("status=all");
    const filters = parseIssueFilters(params);
    expect(filters.status).toEqual([]);
  });

  it("handles sort parameter", () => {
    const params = new URLSearchParams("sort=issue_desc");
    const filters = parseIssueFilters(params);
    expect(filters.sort).toBe("issue_desc");
  });

  it("defaults sort parameter to updated_desc", () => {
    const params = new URLSearchParams("");
    const filters = parseIssueFilters(params);
    expect(filters.sort).toBe("updated_desc");
  });

  it.each(["severity_desc", "priority_asc", "assignee_desc"])(
    "accepts the %s sort",
    (sort) => {
      expect(parseIssueFilters(new URLSearchParams({ sort })).sort).toBe(sort);
    }
  );

  it.each(["status_desc", "id_asc", "bogus"])(
    "falls back to updated_desc for the unsupported %s sort",
    (sort) => {
      expect(parseIssueFilters(new URLSearchParams({ sort })).sort).toBe(
        "updated_desc"
      );
    }
  );

  it("parses include_inactive_machines=true", () => {
    const params = new URLSearchParams("include_inactive_machines=true");
    const filters = parseIssueFilters(params);
    expect(filters.includeInactiveMachines).toBe(true);
  });

  it("parses Summary Widget populations, treating anything but filtered as All", () => {
    const filters = parseIssueFilters(
      new URLSearchParams("status_widget=filtered&severity_widget=bogus")
    );
    expect(filters.statusWidget).toBe("filtered");
    expect(filters.severityWidget).toBeUndefined();
    expect(filters.priorityWidget).toBeUndefined();
  });
});

describe("hasActiveIssueFilters", () => {
  it("returns true when q is present", () => {
    const params = new URLSearchParams("q=test");
    expect(hasActiveIssueFilters(params)).toBe(true);
  });

  it("returns true when status is present", () => {
    const params = new URLSearchParams("status=new");
    expect(hasActiveIssueFilters(params)).toBe(true);
  });

  it("returns true when machine is present", () => {
    const params = new URLSearchParams("machine=AFM");
    expect(hasActiveIssueFilters(params)).toBe(true);
  });

  it("returns true when watching filter is set", () => {
    const params = new URLSearchParams("watching=true");
    expect(hasActiveIssueFilters(params)).toBe(true);
  });

  it("returns true when include_inactive_machines is set", () => {
    const params = new URLSearchParams("include_inactive_machines=true");
    expect(hasActiveIssueFilters(params)).toBe(true);
  });

  it("returns false when only page/page_size/sort are present", () => {
    const params = new URLSearchParams("page=2&page_size=25&sort=issue_asc");
    expect(hasActiveIssueFilters(params)).toBe(false);
  });

  it("returns false when no params are present", () => {
    const params = new URLSearchParams("");
    expect(hasActiveIssueFilters(params)).toBe(false);
  });
});

describe("machineIssuesHref", () => {
  it("opens one machine's issues in every presence state (issues-list §7.4)", () => {
    const href = machineIssuesHref("AFM");
    const url = new URL(href, "https://pinpoint.test");

    expect(url.pathname).toBe("/issues");
    const filters = parseIssueFilters(url.searchParams);
    expect(filters.machine).toEqual(["AFM"]);
    expect(filters.includeInactiveMachines).toBe(true);
  });
});
