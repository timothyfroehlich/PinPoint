"use client";

import * as React from "react";
import { UnsavedChangesGuard } from "~/hooks/use-unsaved-changes-guard";

interface DirtyStateContextValue {
  setSectionDirty: (sectionId: string, isDirty: boolean) => void;
}

const DirtyStateContext = React.createContext<DirtyStateContextValue | null>(
  null
);

export function IntegrationsDirtyStateProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [dirtySections, setDirtySections] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const isDirty = dirtySections.size > 0;

  const setSectionDirty = React.useCallback(
    (sectionId: string, sectionIsDirty: boolean): void => {
      setDirtySections((current) => {
        const next = new Set(current);
        if (sectionIsDirty) next.add(sectionId);
        else next.delete(sectionId);
        return next;
      });
    },
    []
  );
  const contextValue = React.useMemo(
    () => ({ setSectionDirty }),
    [setSectionDirty]
  );

  return (
    <DirtyStateContext.Provider value={contextValue}>
      {children}
      <UnsavedChangesGuard isDirty={isDirty} />
    </DirtyStateContext.Provider>
  );
}

export function useIntegrationDirtyState(
  sectionId: string,
  isDirty: boolean
): void {
  const context = React.useContext(DirtyStateContext);
  if (!context) {
    throw new Error(
      "useIntegrationDirtyState must be used within IntegrationsDirtyStateProvider"
    );
  }

  React.useEffect(() => {
    context.setSectionDirty(sectionId, isDirty);
    return () => {
      context.setSectionDirty(sectionId, false);
    };
  }, [context, isDirty, sectionId]);
}
