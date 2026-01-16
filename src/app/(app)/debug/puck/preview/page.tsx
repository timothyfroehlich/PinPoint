import type React from "react";
import { PuckRenderer } from "~/components/puck/PuckRenderer";

/**
 * Puck preview page for viewing prototypes without the editor interface.
 * 
 * Renders the saved prototype data in a clean view.
 * Accessible at /debug/puck/preview
 */
export default function PuckPreviewPage(): React.JSX.Element {
  return <PuckRenderer />;
}
