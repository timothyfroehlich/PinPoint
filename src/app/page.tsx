"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { DevLoginCompact } from "./_components/DevLoginCompact";
import LoginModal from "./_components/LoginModal";

export default function HomePage(): React.ReactNode {
  const router = useRouter();
  // For now, we'll use a simple state to simulate login.
  // In a real app, this would be determined by `useSession` from next-auth.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // A simple way to "log in" for demonstration purposes.
  // In the real app, the magic link flow will handle this.
  const handleLogin = (): void => {
    setIsLoggedIn(true);
  };

  // Redirect to dashboard when logged in
  useEffect(() => {
    if (isLoggedIn) {
      router.push("/dashboard");
    }
  }, [isLoggedIn, router]);

  // This is a temporary hack to allow the login modal to "work"
  if (!isLoggedIn) {
    return (
      <>
        <LoginModal onLogin={handleLogin} />
        <DevLoginCompact onLogin={handleLogin} />
      </>
    );
  }

  // Show loading state while redirecting
  return null;
}
