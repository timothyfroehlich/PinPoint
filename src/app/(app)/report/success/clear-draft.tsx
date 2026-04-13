"use client";

import { useEffect } from "react";

/**
 * Client component that clears the report form draft from localStorage.
 * Mounted on the success page to ensure drafts are cleared after successful submission.
 *
 * This is needed because the server action redirects before the client-side
 * cleanup effect in the form component can run.
 */
export function ClearReportDraft(): null {
  useEffect(() => {
    window.localStorage.removeItem("report_form_state");
  }, []);

  return null;
}
