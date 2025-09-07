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
  console.log(`[PAGE_HOMEPAGE] Host: "${host ?? "null"}"`);
  console.log(
    `[PAGE_HOMEPAGE] Subdomain header (${SUBDOMAIN_HEADER}): "${sub ?? "null"}"`,
  );
  console.log(
    `[PAGE_HOMEPAGE] Verified header (${SUBDOMAIN_VERIFIED_HEADER}): "${verified ?? "null"}"`,
  );
  console.log(
    `[PAGE_HOMEPAGE] Should redirect: ${String(Boolean(sub && verified))}`,
  );

  if (sub && verified) {
    console.log(`[PAGE_HOMEPAGE] Redirecting to /auth/sign-in`);
    redirect("/auth/sign-in");
  }

  console.log(`[PAGE_HOMEPAGE] Showing homepage`);

  // Temporary debug display for production testing
  const debugInfo = {
    host,
    subdomain: sub,
    verified,
    shouldRedirect: Boolean(sub && verified),
  };

  return (
    <div>
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          background: "red",
          color: "white",
          padding: "10px",
          fontSize: "12px",
          zIndex: 9999,
          fontFamily: "monospace",
        }}
      >
        DEBUG: {JSON.stringify(debugInfo, null, 2)}
      </div>
      <PinPointHomepage />
    </div>
  );
}
