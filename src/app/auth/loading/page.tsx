import type React from "react";

import { LoadingClient } from "./LoadingClient";

function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export default async function AuthLoadingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = rawNext && isInternalPath(rawNext) ? rawNext : "/";

  return <LoadingClient nextPath={nextPath} />;
}
