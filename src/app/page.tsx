"use client";

import { Box } from "@mui/material";
import dynamic from "next/dynamic";

import { AuthenticatedDashboard } from "./_components/AuthenticatedDashboard";
import { PublicDashboard } from "./_components/PublicDashboard";

import { useAuth } from "~/app/auth-provider";

// Dynamic import with SSR disabled for dev login component
// This prevents browser-only code from running during SSR/build
const DevLoginCompact = dynamic(
  () =>
    import("./_components/DevLoginCompact").then((mod) => ({
      default: mod.DevLoginCompact,
    })),
  {
    ssr: false,
    loading: () => null, // No loading state needed for dev helper
  },
);

export default function HomePage(): React.ReactNode {
  const { user } = useAuth();

  // Always show public content
  const publicContent = <PublicDashboard />;

  // Show additional authenticated content if logged in
  const authenticatedContent = user ? <AuthenticatedDashboard /> : null;

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
