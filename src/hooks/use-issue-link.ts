"use client";

import { useState, useEffect } from "react";

const LAST_ISSUES_PATH_KEY = "lastIssuesPath";
const DEFAULT_PATH = "/issues";

/**
 * Hook to get the last used issues page path with filters.
 *
 * Reads from localStorage and falls back to a default path.
 * This is a client-side hook and will initially return the default
 * path, updating to the stored path after the component mounts.
 *
 * @returns {string} The href for the issues link.
 */
export function useIssueLink(): string {
  const [href, setHref] = useState(DEFAULT_PATH);

  useEffect(() => {
    try {
      const storedPath = window.localStorage.getItem(LAST_ISSUES_PATH_KEY);
      if (storedPath) {
        setHref(storedPath);
      }
    } catch (error) {
      console.error("Failed to read from localStorage", error);
      // Silently fail, leaving the default path
    }
  }, []);

  return href;
}

/**
 * Stores the last used issues page path in localStorage.
 *
 * @param path - The path to store (e.g., /issues?status=new)
 */
export function storeLastIssuesPath(path: string): void {
  try {
    window.localStorage.setItem(LAST_ISSUES_PATH_KEY, path);
  } catch (error) {
    console.error("Failed to write to localStorage", error);
  }
}
