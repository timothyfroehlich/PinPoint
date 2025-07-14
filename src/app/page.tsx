"use client";

import { useState } from "react";

import { DevLoginCompact } from "./_components/DevLoginCompact";
import LoginModal from "./_components/LoginModal";
import DashboardPage from "./dashboard/page";

export default function HomePage() {
  // For now, we'll use a simple state to simulate login.
  // In a real app, this would be determined by `useSession` from next-auth.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // A simple way to "log in" for demonstration purposes.
  // In the real app, the magic link flow will handle this.
  const handleLogin = () => setIsLoggedIn(true);

  // This is a temporary hack to allow the login modal to "work"
  if (!isLoggedIn) {
    return (
      <>
        <LoginModal onLogin={handleLogin} />
        <DevLoginCompact onLogin={handleLogin} />
      </>
    );
  }

  return <DashboardPage />;
}
