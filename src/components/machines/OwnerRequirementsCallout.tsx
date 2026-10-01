import type React from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ClipboardList } from "lucide-react";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";

interface OwnerRequirementsCalloutProps {
  ownerRequirements: ProseMirrorDoc;
}

/**
 * Displays the machine owner's requirements as an amber/warning callout, always
 * in full (spec issue-detail §6). The title does not name the machine: the
 * page header already does. Only rendered when ownerRequirements is non-empty
 * and the viewer is signed in.
 */
export function OwnerRequirementsCallout({
  ownerRequirements,
}: OwnerRequirementsCalloutProps): React.JSX.Element {
  return (
    <Alert variant="warning" data-testid="owner-requirements-callout">
      <ClipboardList className="size-4" />
      <AlertTitle>Owner&apos;s requirements</AlertTitle>
      {/* Overrides the alert's own paragraph leading so this rich text matches
          every other rich-text surface (cn's tailwind-merge drops the alert's
          conflicting class). */}
      <AlertDescription className="[&_p]:leading-normal">
        <RichTextDisplay content={ownerRequirements} />
      </AlertDescription>
    </Alert>
  );
}
