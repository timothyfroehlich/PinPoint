"use client";

import { Box } from "@mui/material";

import SecondaryHeader from "./_components/SecondaryHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <SecondaryHeader />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, bgcolor: "background.default" }}
      >
        {children}
      </Box>
    </Box>
  );
}
