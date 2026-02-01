// TODO: This is dead code from the old Clerk auth system.
// The project now uses Supabase auth. This should be removed or refactored.
export function useSession(): {
  session: {
    user: { id: null; email: string; app_metadata: { role: string } };
  };
} {
  const session = {
    user: {
      id: null,
      email: "test-user@test.com",
      app_metadata: {
        role: "admin",
      },
    },
  };

  return { session };
}
