import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const session = await auth();

    const users = await db.user.findMany({
      where: {
        OR: [
          { email: { endsWith: "testaccount.dev" } },
          { email: "email9@example.com" },
        ],
      },
    });

    return NextResponse.json({ users, currentUser: session?.user });
  } catch (error) {
    console.error("Error fetching dev users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
