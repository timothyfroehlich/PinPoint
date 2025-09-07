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

  // Debug logging for production troubleshooting
  console.log(`[PAGE_HOMEPAGE] Host: "${host ?? "null"}"`);
  console.log(
    `[PAGE_HOMEPAGE] Subdomain header (${SUBDOMAIN_HEADER}): "${sub ?? "null"}"`,
  );
  console.log(
    `[PAGE_HOMEPAGE] Verified header (${SUBDOMAIN_VERIFIED_HEADER}): "${verified ?? "null"}"`,
  );
  console.log(`[PAGE_HOMEPAGE] Alias subdomain: "${aliasSubdomain ?? "null"}"`);
  // Check redirect conditions
  const middlewareRedirect = Boolean(sub && verified);
  const aliasRedirect = Boolean(aliasSubdomain);
  const shouldRedirect = middlewareRedirect || aliasRedirect;

  console.log(`[PAGE_HOMEPAGE] Should redirect: ${String(shouldRedirect)}`);

  // Redirect if middleware set org headers OR if we detect alias host directly
  if (shouldRedirect) {
    const reason =
      sub && verified ? "middleware headers" : "alias host fallback";
    console.log(`[PAGE_HOMEPAGE] Redirecting to /auth/sign-in (${reason})`);
    redirect("/auth/sign-in");
  }

  console.log(`[PAGE_HOMEPAGE] Showing homepage`);

  // Temporary debug display for production testing
  const debugInfo = {
    host,
    subdomain: sub,
    verified,
    aliasSubdomain,
    middlewareRedirect,
    aliasRedirect,
    shouldRedirect,
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
