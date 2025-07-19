"use client";

import { Box } from "@mui/material";

import SecondaryHeader from "./_components/SecondaryHeader";

import type { JSX } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
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
