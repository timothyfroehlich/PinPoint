"use client";

import { Button, Box, Typography, Avatar } from "@mui/material";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Avatar 
            src={session.user?.image || undefined} 
            alt={session.user?.name || "User"}
            sx={{ width: 32, height: 32 }}
          />
          <Typography variant="body2" color="inherit">
            {session.user?.name || session.user?.email || "Unknown User"}
          </Typography>
        </Box>
        <Button color="inherit" onClick={() => signOut()}>
          Sign out
        </Button>
      </Box>
    );
  }

  return (
    <Button component={Link} href="/login" color="inherit">
      Sign In
    </Button>
  );
}
