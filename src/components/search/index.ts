/**
 * Search Components Barrel Export
 * Phase 3C: Optimized exports for better tree shaking and code splitting
 */

import { lazy } from "react";

// Eager exports for core components used in navigation
export { UniversalSearchInput } from "./universal-search-input";
export { useGlobalSearchShortcut, SearchButtonTrigger } from "./global-search-shortcut";

// Lazy exports for heavy components used in specific pages
export const AdvancedSearchForm = lazy(() => 
  import("./advanced-search-form-optimized").then(mod => ({
    default: mod.AdvancedSearchFormOptimized
  }))
);

export const UniversalSearchResults = lazy(() => 
  import("./universal-search-results").then(mod => ({
    default: mod.UniversalSearchResults
  }))
);

export const GlobalSearchShortcut = lazy(() => 
  import("./global-search-shortcut").then(mod => ({
    default: mod.GlobalSearchShortcut
  }))
);

// Type exports
export type { FilterField, AdvancedSearchFormProps } from "./advanced-search-form";
export type { SearchResult, SearchEntity, SearchOptions, SearchResponse } from "~/lib/services/search-service";

// Configuration exports
export { 
  ISSUES_FILTER_FIELDS,
  MACHINES_FILTER_FIELDS,
  UNIVERSAL_FILTER_FIELDS,
  getFilterFieldsForEntity,
  getFilterField,
  validateFilterValue,
} from "./filter-configs";