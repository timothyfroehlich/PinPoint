import type React from "react";
import { PuckEditor } from "~/components/puck/PuckEditor";

/**
 * Puck visual editor page for UX prototyping.
 * 
 * This is a development-only feature that allows rapid prototyping
 * of UI components and layouts using Puck's drag-and-drop interface.
 * 
 * Only accessible in development mode via /debug/puck
 */
export default function PuckEditorPage(): React.JSX.Element {
  return <PuckEditor />;
}
