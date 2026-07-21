"use client";

import { useEffect } from "react";
import {
  parseDraft,
  serializeDraft,
  emptySingle,
  DRAFT_VERSION,
  REPORT_DRAFT_KEY,
  LEGACY_DRAFT_KEY,
} from "../report-draft-schema";

/**
 * Clears the just-submitted single issue from the persisted report draft.
 * Mounted on the success page because the server action redirects (to
 * /report/success) before the form's own cleanup effect can run.
 *
 * The Single form submits entry #1, so this removes entry #1 (and the reporter
 * identity) — but PRESERVES any extra unsubmitted grid rows so a batch in
 * progress survives a single submit (PP-2m17 #2). Only when entry #1 was the
 * whole draft is the key removed outright. The legacy key is always retired.
 */
export function ClearReportDraft(): null {
  useEffect(() => {
    window.localStorage.removeItem(LEGACY_DRAFT_KEY);

    const draft = parseDraft(window.localStorage.getItem(REPORT_DRAFT_KEY));
    if (!draft || draft.entries.length <= 1) {
      window.localStorage.removeItem(REPORT_DRAFT_KEY);
      return;
    }

    // Drop the submitted entry #1; keep the remaining rows, reset identity.
    window.localStorage.setItem(
      REPORT_DRAFT_KEY,
      serializeDraft({
        version: DRAFT_VERSION,
        entries: draft.entries.slice(1),
        single: emptySingle(),
      })
    );
  }, []);

  return null;
}
