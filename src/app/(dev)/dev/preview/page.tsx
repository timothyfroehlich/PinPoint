import type React from "react";
import { PreviewClient } from "./preview-client";

/**
 * Responsive Preview — server wrapper that gates access to development only.
 * The actual UI is in preview-client.tsx (client component).
 */
export default function PreviewPage(): React.JSX.Element {
  return <PreviewClient />;
}
