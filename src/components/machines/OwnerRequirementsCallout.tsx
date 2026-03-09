import type React from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";

interface OwnerRequirementsCalloutProps {
  ownerRequirements: ProseMirrorDoc;
  machineName: string;
}

/**
 * Displays the machine owner's requirements as an amber/warning callout.
 * Only rendered when ownerRequirements is non-empty and user is authenticated.
 */
export function OwnerRequirementsCallout({
  ownerRequirements,
  machineName,
}: OwnerRequirementsCalloutProps): React.JSX.Element {
  return (
    <Alert variant="warning" data-testid="owner-requirements-callout">
      <AlertTriangle className="size-4" />
      <AlertTitle>Owner&apos;s Requirements for {machineName}</AlertTitle>
      <AlertDescription>
        <RichTextDisplay content={ownerRequirements} />
      </AlertDescription>
    </Alert>
  );
}
