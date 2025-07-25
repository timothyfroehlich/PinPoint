"use client";

import { Box, Toolbar } from "@mui/material";

import PrimaryAppBar from "../dashboard/_components/PrimaryAppBar";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps): React.JSX.Element {
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
