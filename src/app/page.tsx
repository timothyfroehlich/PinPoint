import { redirect } from "next/navigation";

export default function HomePage(): never {
  // Redirect to public dashboard as we don't have a landing page yet.
  // Unauthenticated users will see the public view of the dashboard.
  redirect("/dashboard");
}
