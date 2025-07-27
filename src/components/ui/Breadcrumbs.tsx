"use client";

import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from "@mui/material";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { type ReactElement } from "react";

/**
 * Breadcrumbs component that automatically generates breadcrumbs based on the current path
 */
export function Breadcrumbs(): ReactElement {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  // Generate breadcrumb items based on path segments
  const breadcrumbItems = pathSegments.map((segment, index) => {
    const href = "/" + pathSegments.slice(0, index + 1).join("/");
    const isLast = index === pathSegments.length - 1;

    // Convert segment to display text (capitalize and replace hyphens)
    const displayText = segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    if (isLast) {
      return (
        <Typography key={href} color="text.primary">
          {displayText}
        </Typography>
      );
    }

    return (
      <Link
        key={href}
        component={NextLink}
        href={href}
        underline="hover"
        color="inherit"
      >
        {displayText}
      </Link>
    );
  });

  // Always include home breadcrumb
  const homeBreadcrumb = (
    <Link
      component={NextLink}
      href="/dashboard"
      underline="hover"
      color="inherit"
    >
      Dashboard
    </Link>
  );

  return (
    <MuiBreadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
      {homeBreadcrumb}
      {breadcrumbItems}
    </MuiBreadcrumbs>
  );
}
