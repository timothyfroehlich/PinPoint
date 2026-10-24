import type React from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { Button } from "~/components/ui/button";
import type { CollectionMachine } from "~/lib/collections/types";

/**
 * Opens Print settings sheets with a group's machines On the Floor already
 * added (settings-sheets §2.6). On phones it is an icon button that keeps its
 * accessible name.
 */
export function PrintSettingsSheetsLink({
  machines,
}: {
  machines: CollectionMachine[];
}): React.JSX.Element {
  const initials = machines
    .filter((machine) => machine.presenceStatus === "on_the_floor")
    .map((machine) => machine.initials);
  const params = new URLSearchParams({ m: initials.join(",") });
  return (
    <Button asChild variant="outline" className="max-md:size-11 max-md:px-0">
      <Link
        href={`/m/settings-sheets?${params.toString()}`}
        aria-label="Print settings sheets"
      >
        <ClipboardList className="size-4 md:mr-2" aria-hidden="true" />
        <span className="max-md:hidden">Settings sheets</span>
      </Link>
    </Button>
  );
}
