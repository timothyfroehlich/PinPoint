"use client";

import { Box } from "@mui/material";
import { useSession } from "next-auth/react";

import { AuthenticatedDashboard } from "./_components/AuthenticatedDashboard";
import { DevLoginCompact } from "./_components/DevLoginCompact";
import { PublicDashboard } from "./_components/PublicDashboard";

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
