"use client";

import { Box, Typography } from "@mui/material";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";

export function NavigationLinks() {
  const { data: session, status } = useSession();

  const { data: membership } = api.user.getCurrentMembership.useQuery(
    undefined,
    {
      enabled: status === "authenticated" && !!session?.user,
      retry: false,
    },
  );

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mr: 2 }}>
      <Typography
        component={Link}
        href="/issues"
        sx={{
          textDecoration: "none",
          color: "inherit",
          "&:hover": {
            opacity: 0.8,
          },
        }}
      >
        Issues
      </Typography>
      {membership?.role === "admin" && (
        <Typography
          component={Link}
          href="/admin/organization"
          sx={{
            textDecoration: "none",
            color: "inherit",
            "&:hover": {
              opacity: 0.8,
            },
          }}
        >
          Organization
        </Typography>
      )}
    </Box>
  );
}
