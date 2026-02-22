import type React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  NotificationList,
  type EnrichedNotification,
} from "~/components/notifications/NotificationList";
import { UserMenu } from "./user-menu-client";
import { HeaderSignInButton } from "./header-sign-in-button";
import { Button } from "~/components/ui/button";

interface MobileHeaderAuthProps {
  isAuthenticated: true;
  userName: string;
  notifications: EnrichedNotification[];
}

interface MobileHeaderUnauthProps {
  isAuthenticated: false;
  userName?: undefined;
  notifications?: undefined;
}

type MobileHeaderProps = MobileHeaderAuthProps | MobileHeaderUnauthProps;

/**
 * Compact sticky header for mobile viewports (hidden on md+).
 *
 * Auth state:   [P PinPoint]  [APC logo]  [🔔 badge] [AU avatar]
 * Unauth state: [P PinPoint]  [APC logo]  [Sign In]  [Sign Up ↗]
 *
 * Height: 52px — matches the mockup's --header-h variable.
 */
export function MobileHeader(props: MobileHeaderProps): React.JSX.Element {
  return (
    <header
      className="md:hidden flex h-[52px] items-center justify-between px-4 border-b border-border bg-card/85 backdrop-blur-sm sticky top-0 z-20"
      data-testid="mobile-header"
    >
      {/* Logo — left side */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2"
        aria-label="PinPoint"
      >
        <Image
          src="/logo-pinpoint-transparent.png"
          alt="P"
          width={28}
          height={28}
          className="object-contain h-7 w-7"
          priority
        />
        <span className="text-base font-bold tracking-tight text-foreground">
          PinPoint
        </span>
      </Link>

      {/* APC logo — center */}
      <a
        href="https://austinpinballcollective.org"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Austin Pinball Collective"
      >
        <Image
          src="/apc-logo.png"
          alt="Austin Pinball Collective"
          width={64}
          height={38}
          className="h-6 w-auto object-contain shrink-0"
        />
      </a>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {props.isAuthenticated ? (
          <>
            <NotificationList notifications={props.notifications} />
            <UserMenu
              userName={props.userName}
              testId="mobile-user-menu-button"
            />
          </>
        ) : (
          <>
            <HeaderSignInButton
              testId="mobile-nav-signin"
              className="text-muted-foreground hover:text-foreground text-sm"
            />
            <Button
              asChild
              size="sm"
              className="text-xs px-3 h-8"
              data-testid="mobile-nav-signup"
            >
              <Link href="/signup">Sign Up</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
