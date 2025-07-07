"use client";

import { useEffect, useState } from "react";
import { type User } from "@prisma/client";
import { useCurrentUser } from "~/lib/hooks/use-current-user";

export function ImpersonationMenu() {
  const { user } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dev/users");
        if (!res.ok) {
          console.error(
            "Failed to fetch dev users:",
            res.status,
            res.statusText,
          );
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { users } = await res.json();
        console.log("Fetched dev users:", users);
        setUsers(users as User[]);
      } catch (error) {
        console.error("Error fetching dev users:", error);
      }
    }

    void fetchData();
  }, []);

  async function handleImpersonate(userId: string) {
    console.log("handleImpersonate called with userId:", userId);

    if (userId === "logout") {
      console.log("Logging out impersonation");
      await fetch("/api/dev/impersonate/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      // Force a full page reload to clear the impersonation
      window.location.reload();
      return;
    }

    console.log("Making impersonate request with userId:", userId);
    const response = await fetch("/api/dev/impersonate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    console.log("Impersonate response status:", response.status);
    if (response.ok) {
      console.log("Impersonation successful, reloading page");
      // Force a full page reload to pick up the new impersonation
      window.location.reload();
    } else {
      console.error("Failed to impersonate user");
      const errorText = await response.text();
      console.error("Error response:", errorText);
    }
  }

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="impersonation-menu">
      <select
        onChange={(e) => void handleImpersonate(e.target.value)}
        value={user?.id ?? ""}
      >
        <option value="">-- Select User to Impersonate --</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.email})
          </option>
        ))}
        <option value="logout">Log Out</option>
      </select>
    </div>
  );
}
