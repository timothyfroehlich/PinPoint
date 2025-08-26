"use client";

import { Box, Toolbar } from "@mui/material";

import PrimaryAppBar from "../dashboard/_components/PrimaryAppBar";
import { useClientMounted } from "~/hooks/useClientMounted";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps): React.JSX.Element {
  const isMounted = useClientMounted();

  if (!isMounted) {
    // Render minimal layout during SSR/hydration to prevent mismatch
    return (
      <>
        <Box
          component="header"
          sx={{ height: 64, bgcolor: "background.paper" }}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: "background.default",
            minHeight: "calc(100vh - 64px)",
          }}
        >
          {children}
        </Box>
      </>
    );
  }

  return (
    <>
      <PrimaryAppBar />
      <Toolbar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "background.default",
          minHeight: "calc(100vh - 64px)", // Full height minus AppBar
        }}
      >
        {children}
      </Box>
    </>
  );
}
