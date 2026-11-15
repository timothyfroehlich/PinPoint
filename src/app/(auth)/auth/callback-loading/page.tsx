import type React from "react";

import { getSafeRedirect } from "~/lib/url";

import { CallbackLoadingClient } from "./CallbackLoadingClient";

export default async function AuthLoadingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = getSafeRedirect(rawNext, "/");

  return <CallbackLoadingClient nextPath={nextPath} />;
}
