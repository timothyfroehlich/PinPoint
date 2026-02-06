import type React from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { PageShell } from "~/components/layout/PageShell";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_DESCRIPTIONS,
  ACCESS_LEVEL_LABELS,
  PERMISSIONS_MATRIX,
  type PermissionValue,
} from "~/lib/permissions/matrix";

export const metadata = {
  title: "Roles & Permissions | PinPoint",
};

function PermissionValueCell({
  value,
}: {
  value: PermissionValue;
}): React.JSX.Element {
  if (value === true) {
    return (
      <span className="text-green-600 dark:text-green-400">
        <Check className="size-4" aria-label="Allowed" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-muted-foreground">
        <Minus className="size-4" aria-label="Not allowed" />
      </span>
    );
  }
  if (value === "own") {
    return (
      <Badge variant="secondary" className="text-xs">
        Own only
      </Badge>
    );
  }
  // value === "owner"
  return (
    <Badge variant="secondary" className="text-xs">
      Owner only
    </Badge>
  );
}

export default function PermissionsPage(): React.JSX.Element {
  return (
    <PageShell size="default">
      <header className="space-y-2 mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/help" className="text-primary hover:underline">
            Help
          </Link>{" "}
          / Roles &amp; Permissions
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Roles &amp; Permissions
        </h1>
        <p className="text-sm text-muted-foreground">
          What each role can do in PinPoint. Permissions are checked on every
          action — the tables below reflect the current system rules.
        </p>
      </header>

      {/* Role tier descriptions */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Role Tiers</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ACCESS_LEVELS.map((level) => (
            <div key={level} className="rounded-lg border p-4">
              <p className="font-medium">{ACCESS_LEVEL_LABELS[level]}</p>
              <p className="text-sm text-muted-foreground">
                {ACCESS_LEVEL_DESCRIPTIONS[level]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Legend */}
      <section className="space-y-2 mb-8">
        <h2 className="text-lg font-semibold">Legend</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4 text-green-600 dark:text-green-400" />
            Allowed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="size-4 text-muted-foreground" />
            Not allowed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              Own only
            </Badge>
            Only for resources you reported
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              Owner only
            </Badge>
            Only for resources you own
          </span>
        </div>
      </section>

      {/* Permission tables by category */}
      {PERMISSIONS_MATRIX.map((category) => (
        <section key={category.id} className="space-y-3 mb-8">
          <h2 className="text-lg font-semibold">{category.label}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Permission</TableHead>
                {ACCESS_LEVELS.map((level) => (
                  <TableHead key={level} className="text-center">
                    {ACCESS_LEVEL_LABELS[level]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {category.permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell>
                    <span className="font-medium">{permission.label}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {permission.description}
                    </span>
                  </TableCell>
                  {ACCESS_LEVELS.map((level) => (
                    <TableCell key={level} className="text-center">
                      <PermissionValueCell value={permission.access[level]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </PageShell>
  );
}
