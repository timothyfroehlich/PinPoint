import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const { userId } = (await req.json()) as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("next-auth.session-token.impersonated", userId, {
      httpOnly: true,
      secure: false, // Development only
      sameSite: "lax",
    });

    return NextResponse.json({ success: true, impersonatedUserId: userId });
  } catch (error) {
    console.error("Error in impersonation API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
