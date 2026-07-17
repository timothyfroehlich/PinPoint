"use client";

import { useEffect } from "react";
import { REPORT_DRAFT_KEY, LEGACY_DRAFT_KEY } from "../report-draft-schema";

/**
 * Client component that clears the report draft from localStorage. Mounted on
 * the success page to clear the draft after a successful submission.
 *
 * This is needed because the server action redirects (to /report/success) before
 * the client-side cleanup effect in the form component can run. Clears both the
 * current unified key and the legacy single-form key.
 */
export function ClearReportDraft(): null {
  useEffect(() => {
    window.localStorage.removeItem(REPORT_DRAFT_KEY);
    window.localStorage.removeItem(LEGACY_DRAFT_KEY);
  }, []);

  return null;
}
