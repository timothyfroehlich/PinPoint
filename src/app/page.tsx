import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PinPointHomepage } from "~/components/homepage/PinPointHomepage";
import {
  SUBDOMAIN_HEADER,
  SUBDOMAIN_VERIFIED_HEADER,
} from "~/lib/subdomain-verification";

export default async function HomePage(): Promise<React.JSX.Element> {
  // If request is already scoped to an organization (via subdomain or alias),
  // do not show the generic landing page; send users to sign-in.
  const h = await headers();
  const sub = h.get(SUBDOMAIN_HEADER);
  const verified = h.get(SUBDOMAIN_VERIFIED_HEADER);
  const host = h.get("host");

  // Debug logging for production troubleshooting
  console.log(`[PAGE_HOMEPAGE] Host: "${host}"`);
  console.log(
    `[PAGE_HOMEPAGE] Subdomain header (${SUBDOMAIN_HEADER}): "${sub}"`,
  );
  console.log(
    `[PAGE_HOMEPAGE] Verified header (${SUBDOMAIN_VERIFIED_HEADER}): "${verified}"`,
  );
  console.log(`[PAGE_HOMEPAGE] Should redirect: ${Boolean(sub && verified)}`);

  if (sub && verified) {
    console.log(`[PAGE_HOMEPAGE] Redirecting to /auth/sign-in`);
    redirect("/auth/sign-in");
  }

  console.log(`[PAGE_HOMEPAGE] Showing homepage`);
  return <PinPointHomepage />;
}
