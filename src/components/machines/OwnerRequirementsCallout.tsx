import type React from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
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
 *
 * Static guidance, not an event: `role="note"` replaces the Alert's
 * `role="alert"`, and the title is an `h2` in the page outline (Activity is
 * the next `h2`), not AlertTitle's `h5`.
 */
export function OwnerRequirementsCallout({
  ownerRequirements,
}: OwnerRequirementsCalloutProps): React.JSX.Element {
  return (
    <Alert
      variant="warning"
      role="note"
      aria-labelledby="owner-requirements-title"
      data-testid="owner-requirements-callout"
    >
      <ClipboardList className="size-4" aria-hidden="true" />
      <h2
        id="owner-requirements-title"
        className="mb-1 text-balance text-sm font-medium leading-none tracking-tight"
      >
        Owner&apos;s requirements
      </h2>
      {/* Overrides the alert's own paragraph leading so this rich text matches
          every other rich-text surface (cn's tailwind-merge drops the alert's
          conflicting class). */}
      <AlertDescription className="[&_p]:leading-normal">
        <RichTextDisplay content={ownerRequirements} />
      </AlertDescription>
    </Alert>
  );
}
