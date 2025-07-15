"use client";

import { Box, Toolbar } from "@mui/material";
import { usePathname } from "next/navigation";

import PrimaryAppBar from "../dashboard/_components/PrimaryAppBar";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const pathname = usePathname();

  // Don't show navigation on login page
  const isLoginPage = pathname === "/";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <PrimaryAppBar />
      <Toolbar />
      <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default" }}>
        {children}
      </Box>
    </>
  );
}
