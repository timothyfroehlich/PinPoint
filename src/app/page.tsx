import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PinPointHomepage } from "~/components/homepage/PinPointHomepage";
import {
  SUBDOMAIN_HEADER,
  SUBDOMAIN_VERIFIED_HEADER,
} from "~/lib/subdomain-verification";
import { ORG_ALIAS_HOSTS } from "~/lib/domain-org-mapping";

export default async function HomePage(): Promise<React.JSX.Element> {
  // If request is already scoped to an organization (via subdomain or alias),
  // do not show the generic landing page; send users to sign-in.
  const h = await headers();
  const sub = h.get(SUBDOMAIN_HEADER);
  const verified = h.get(SUBDOMAIN_VERIFIED_HEADER);
  const host = h.get("host");

  // Fallback: Check for alias hosts directly (when middleware fails to execute)
  const aliasSubdomain = host ? ORG_ALIAS_HOSTS[host] : null;

  // Check redirect conditions
  const middlewareRedirect = Boolean(sub && verified);
  const aliasRedirect = Boolean(aliasSubdomain);
  const shouldRedirect = middlewareRedirect || aliasRedirect;

  // Redirect if middleware set org headers OR if we detect alias host directly
  if (shouldRedirect) {
    redirect("/auth/sign-in");
  }

  return <PinPointHomepage />;
}
