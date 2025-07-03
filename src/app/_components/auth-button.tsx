"use client";

import { Button } from "@mui/material";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <Button color="inherit" onClick={() => signOut()}>
        Sign out
      </Button>
    );
  }

  return (
    <Button component={Link} href="/login" color="inherit">
      Sign In
    </Button>
  );
}
