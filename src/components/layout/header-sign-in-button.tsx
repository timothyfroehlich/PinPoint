"use client";

import type React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { getLoginUrl } from "~/lib/login-url";

export function HeaderSignInButton(): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-foreground"
      data-testid="nav-signin"
    >
      <Link href={getLoginUrl(returnTo)}>Sign In</Link>
    </Button>
  );
}
