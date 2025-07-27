"use client";

import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from "@mui/material";
import NextLink from "next/link";
import { usePathname } from "next/navigation";

export function Breadcrumbs(): React.JSX.Element {
  const pathname = usePathname();

  const getBreadcrumbs = (): { label: string; href: string }[] => {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs = [{ label: "Settings", href: "/settings" }];

    if (segments.includes("roles")) {
      breadcrumbs.push({
        label: "Roles & Permissions",
        href: "/settings/roles",
      });
    }

    if (segments.includes("users")) {
      breadcrumbs.push({ label: "Users", href: "/settings/users" });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <MuiBreadcrumbs aria-label="breadcrumb">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        if (isLast) {
          return (
            <Typography key={crumb.href} color="text.primary">
              {crumb.label}
            </Typography>
          );
        }

        return (
          <Link
            key={crumb.href}
            component={NextLink}
            href={crumb.href}
            color="inherit"
            underline="hover"
          >
            {crumb.label}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}
