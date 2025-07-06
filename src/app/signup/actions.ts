"use server";

import { hash } from "bcrypt";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { signIn } from "~/server/auth";

export async function signup(prevState: string | undefined, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Basic validation
  if (!name || !email || !password) {
    return "All fields are required.";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters long.";
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

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user using the same pattern as seed.ts
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Automatically sign in after signup
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    redirect("/");
  } catch (error) {
    console.error("Signup error:", error);
    return "An error occurred during signup. Please try again.";
  }
}
