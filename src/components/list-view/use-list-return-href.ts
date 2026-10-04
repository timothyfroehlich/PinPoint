"use client";

import * as React from "react";
import { LIST_RETURN_EVENT, readListUrl } from "~/lib/list-view/return-to-list";

/**
 * The href app navigation uses for the list at `listPath` (list-views §11.1):
 * the last URL this tab session showed there, else the plain path. The server
 * render and the first client render both use the plain path; the stored URL
 * replaces it once mounted, and again whenever the list remembers a new one.
 */
export function useListReturnHref(listPath: string): string {
  const [href, setHref] = React.useState(listPath);
  React.useEffect(() => {
    const read = (): void => setHref(readListUrl(listPath) ?? listPath);
    read();
    window.addEventListener(LIST_RETURN_EVENT, read);
    return () => window.removeEventListener(LIST_RETURN_EVENT, read);
  }, [listPath]);
  return href;
}
