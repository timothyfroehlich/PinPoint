"use server";

import { redirect } from "next/navigation";
import { db } from "~/server/db";

export async function signup(
  prevState: string | undefined,
  formData: FormData,
) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  // Basic validation
  if (!name || !email) {
    return "Name and email are required.";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address.";
  }

  try {
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return "User with this email already exists.";
    }

    // Create user - they'll sign in via OAuth providers
    await db.user.upsert({
      where: { email },
      update: {},
      create: {
        name,
        email,
      },
    });

    // Redirect to sign in page - users will authenticate via OAuth
    redirect("/api/auth/signin");
  } catch (error) {
    console.error("Signup error:", error);
    return "An error occurred during signup. Please try again.";
  }
}
