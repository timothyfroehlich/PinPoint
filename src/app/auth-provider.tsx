"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type JSX,
} from "react";

import type { PinPointSupabaseUser } from "~/lib/types";

import { createClient } from "~/utils/supabase/client";

interface AuthContextType {
  user: PinPointSupabaseUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [user, setUser] = useState<PinPointSupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect((): (() => void) => {
    // Get initial session
    const getInitialSession = async (): Promise<void> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user as PinPointSupabaseUser | null);
      setLoading(false);
    };

    void getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session): void => {
      setUser(session?.user as PinPointSupabaseUser | null);
      setLoading(false);
    });

    return (): void => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
