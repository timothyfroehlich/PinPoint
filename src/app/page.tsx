import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PinPointHomepage } from "~/components/homepage/PinPointHomepage";
import { SUBDOMAIN_HEADER, SUBDOMAIN_VERIFIED_HEADER } from "~/lib/subdomain-verification";

export default async function HomePage(): Promise<React.JSX.Element> {
  // If request is already scoped to an organization (via subdomain or alias),
  // do not show the generic landing page; send users to sign-in.
  const h = await headers();
  const sub = h.get(SUBDOMAIN_HEADER);
  const verified = h.get(SUBDOMAIN_VERIFIED_HEADER);
  if (sub && verified) {
    redirect("/auth/sign-in");
  }

  return <PinPointHomepage />;
}
