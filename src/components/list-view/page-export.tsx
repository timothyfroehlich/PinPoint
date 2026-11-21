"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "~/lib/export/download-csv";
import type { Result } from "~/lib/result";
import type { PageMenuEntry } from "./PageActions";

/** A List View's Export, offered as a page action in ⋯ (list-views §5.5). */
export interface PageExport {
  /** Builds the CSV on the server; the EMPTY code means nothing matched. */
  exportCsv: () => Promise<Result<{ csv: string; fileName: string }>>;
  /** The toast when nothing matches, such as "No issues to export." */
  emptyMessage: string;
}

const PageExportContext = React.createContext<PageExport | null>(null);
const SetPageExportContext = React.createContext<
  ((value: PageExport | null) => void) | null
>(null);

/**
 * Carries a list's Export up to the page actions that hold it in ⋯. A page
 * whose actions sit outside its list (a Collection or Tag page header)
 * wraps both; a List View that draws its own title row wraps itself.
 */
export function PageExportProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [value, setValue] = React.useState<PageExport | null>(null);
  return (
    <SetPageExportContext.Provider value={setValue}>
      <PageExportContext.Provider value={value}>
        {children}
      </PageExportContext.Provider>
    </SetPageExportContext.Provider>
  );
}

/**
 * Offers a list's Export to the nearest PageExportProvider while mounted.
 * Pass a memoized value; null offers none. Without a provider it does
 * nothing.
 */
export function RegisterPageExport({
  value,
}: {
  value: PageExport | null;
}): null {
  const setValue = React.useContext(SetPageExportContext);
  React.useEffect(() => {
    if (!setValue) return undefined;
    setValue(value);
    return () => setValue(null);
  }, [setValue, value]);
  return null;
}

/**
 * The ⋯ entry for the page's Export, or null when the page offers none.
 * Running it saves the CSV, or explains in a toast why it could not.
 */
export function usePageExportEntry(): PageMenuEntry | null {
  const pageExport = React.useContext(PageExportContext);
  const [busy, setBusy] = React.useState(false);
  if (!pageExport) return null;
  const { exportCsv, emptyMessage } = pageExport;

  async function run(): Promise<void> {
    setBusy(true);
    try {
      const result = await exportCsv();
      if (!result.ok) {
        if (result.code === "EMPTY") toast.info(emptyMessage);
        else toast.error(result.message);
        return;
      }
      if (!downloadCsv(result.value.csv, result.value.fileName)) {
        toast.error(
          "Download failed. Your browser may not support file downloads."
        );
      }
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return {
    key: "export",
    label: "Export to CSV",
    // As ⋯'s only entry it shows as an Export button (issues-list 2.3).
    icon: Download,
    buttonLabel: "Export",
    busy,
    testId: "export-csv-button",
    onSelect: () => {
      void run();
    },
  };
}
