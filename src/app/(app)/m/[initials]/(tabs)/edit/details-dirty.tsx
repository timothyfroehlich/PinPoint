"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

/**
 * Whether the Details form has unsaved edits — shared across the Manage tab's
 * sections (PP-3bbr.3).
 *
 * The tab deliberately gives each section its own save model: Details fields
 * save together behind a Save button, while every Pinball Map control acts the
 * moment it is clicked. That works because the sections are about different
 * things — except they are not. **Details owns the Pinball Map link.** Its form
 * carries `pbmLinkPresent=1`, so any save from it rewrites the link columns
 * from whatever the Model Details field currently shows.
 *
 * So while Details is dirty, the Pinball Map controls are acting on a link the
 * pending save may be about to change: set the intent On for a catalog title,
 * press Save, and the machine is on Manual Entry with an intent that means
 * nothing. Worse, the operator had every reason to think they were setting
 * intent for the model they can see in the form.
 *
 * `MachineDetailsForm` owns the state — it is the only writer, and its own
 * beforeunload and navigation guards read it — and this context is how the
 * Pinball Map section gets to see it.
 *
 * **This goes away with PP-53ns**, which removes the save bar and makes each
 * field save on its own interaction. With no unsaved state there is nothing to
 * gate against, and the Pinball Map section can follow the Source selection
 * live instead.
 */
interface DetailsDirtyValue {
  dirty: boolean;
  setDirty: (next: boolean) => void;
}

const DetailsDirtyContext = createContext<DetailsDirtyValue | null>(null);

export function DetailsDirtyProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [dirty, setDirty] = useState(false);
  const value = useMemo(() => ({ dirty, setDirty }), [dirty]);
  return (
    <DetailsDirtyContext.Provider value={value}>
      {children}
    </DetailsDirtyContext.Provider>
  );
}

/**
 * Throws outside the provider rather than defaulting to "clean". A silent
 * `false` would leave the Pinball Map controls live over unsaved edits — the
 * exact bug this exists to prevent — and it would do it invisibly.
 */
export function useDetailsDirty(): DetailsDirtyValue {
  const value = useContext(DetailsDirtyContext);
  if (value === null) {
    throw new Error("useDetailsDirty must be used inside DetailsDirtyProvider");
  }
  return value;
}
