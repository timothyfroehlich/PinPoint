"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface DirtyStateContextValue {
  setSectionDirty: (sectionId: string, isDirty: boolean) => void;
}

const DirtyStateContext = React.createContext<DirtyStateContextValue | null>(
  null
);

interface PendingNavigation {
  href: string;
}

export function IntegrationsDirtyStateProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const [dirtySections, setDirtySections] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [pendingNavigation, setPendingNavigation] =
    React.useState<PendingNavigation | null>(null);
  const navigationConfirmed = React.useRef(false);
  const lastInterceptedLink = React.useRef<HTMLAnchorElement | null>(null);
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

  React.useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (navigationConfirmed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  React.useEffect(() => {
    if (!isDirty) return;
    const handleClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !link ||
        (link.target !== "" && link.target !== "_self") ||
        link.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      lastInterceptedLink.current = link;
      setPendingNavigation({
        href: `${destination.pathname}${destination.search}${destination.hash}`,
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty]);

  const leavePage = (): void => {
    if (!pendingNavigation) return;
    navigationConfirmed.current = true;
    router.push(pendingNavigation.href);
    setPendingNavigation(null);
    window.setTimeout(() => {
      navigationConfirmed.current = false;
    }, 0);
  };

  return (
    <DirtyStateContext.Provider value={contextValue}>
      {children}
      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            if (navigationConfirmed.current) return;
            const link = lastInterceptedLink.current;
            if (link && document.contains(link)) {
              event.preventDefault();
              link.focus();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes on this page. If you leave now, those
              changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on page</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={leavePage}>
              Discard and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
