import type React from "react";
import { redirect } from "next/navigation";
import { PreviewClient } from "./preview-client";

/**
 * Responsive Preview — server wrapper that gates access to development only.
 * The actual UI is in preview-client.tsx (client component).
 */
export default function PreviewPage(): React.JSX.Element {
  if (process.env.NODE_ENV === "production") {
    redirect("/dashboard");
  }

  return <PreviewClient />;
}
