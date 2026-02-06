import type React from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { PageShell } from "~/components/layout/PageShell";
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
  type AccessLevel,
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
      <span className="flex justify-center text-green-600 dark:text-green-400">
        <Check className="size-4" aria-label="Allowed" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="flex justify-center text-muted-foreground">
        <Minus className="size-4" aria-label="Not allowed" />
      </span>
    );
  }
  // Both "own" and "owner" mean "only if it's yours" from a user perspective
  return (
    <span className="flex justify-center text-xs text-muted-foreground italic">
      Yours only
    </span>
  );
}

interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  access: Record<AccessLevel, PermissionValue>;
}

interface GroupedPermission {
  id: string;
  label: string;
  description: string;
  access: Record<AccessLevel, PermissionValue>;
  isGroup: boolean;
}

/**
 * Group consecutive permissions with identical access patterns
 */
function groupPermissions(
  permissions: PermissionDefinition[]
): GroupedPermission[] {
  const grouped: GroupedPermission[] = [];
  let i = 0;

  while (i < permissions.length) {
    const current = permissions[i];
    if (!current) break; // Should never happen, but satisfies strict checks

    const accessPattern = JSON.stringify(current.access);

    // Look ahead to find consecutive permissions with the same access pattern
    const group: PermissionDefinition[] = [current];
    let j = i + 1;

    while (j < permissions.length) {
      const next = permissions[j];
      if (!next) break; // Should never happen, but satisfies strict checks

      if (JSON.stringify(next.access) === accessPattern) {
        group.push(next);
        j++;
      } else {
        break;
      }
    }

    if (group.length > 1) {
      // Multiple permissions with identical access - group them
      grouped.push({
        id: group.map((p) => p.id).join(","),
        label: group.map((p) => p.label).join(" / "),
        description: group.map((p) => p.description).join("; "),
        access: current.access,
        isGroup: true,
      });
      i = j;
    } else {
      // Single permission - keep as is
      grouped.push({
        id: current.id,
        label: current.label,
        description: current.description,
        access: current.access,
        isGroup: false,
      });
      i++;
    }
  }

  return grouped;
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
            <span className="text-xs text-muted-foreground italic">
              Yours only
            </span>
            Only for resources you created or own
          </span>
        </div>
      </section>

      {/* Permission tables by category */}
      {PERMISSIONS_MATRIX.map((category) => {
        const groupedPermissions = groupPermissions(category.permissions);
        return (
          <section key={category.id} className="space-y-3 mb-8">
            <h2 className="text-lg font-semibold">{category.label}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Permission</TableHead>
                  {ACCESS_LEVELS.map((level) => (
                    <TableHead key={level} className="w-28 text-center">
                      {ACCESS_LEVEL_LABELS[level]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedPermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <span className="font-medium">{permission.label}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {permission.description}
                      </span>
                    </TableCell>
                    {ACCESS_LEVELS.map((level) => (
                      <TableCell key={level} className="w-28 text-center">
                        <PermissionValueCell value={permission.access[level]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        );
      })}
    </PageShell>
  );
}
