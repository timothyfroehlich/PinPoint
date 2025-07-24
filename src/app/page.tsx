"use client";

import { useSession } from "next-auth/react";
import { Box } from "@mui/material";

import { PublicDashboard } from "./_components/PublicDashboard";
import { AuthenticatedDashboard } from "./_components/AuthenticatedDashboard";
import { DevLoginCompact } from "./_components/DevLoginCompact";

export default function HomePage(): React.ReactNode {
  const { data: session } = useSession();

  // Always show public content
  const publicContent = <PublicDashboard />;

  // Show additional authenticated content if logged in
  const authenticatedContent = session ? <AuthenticatedDashboard /> : null;

  return (
    <Box>
      {/* Public content - visible to everyone */}
      {publicContent}

      {/* Authenticated content - only visible when logged in */}
      {authenticatedContent}

      {/* Dev login helper - only in development */}
      <DevLoginCompact />
    </Box>
  );
}
