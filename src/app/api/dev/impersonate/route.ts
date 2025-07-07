import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface ImpersonateRequest {
  userId: string;
}

export async function POST(req: Request) {
  console.log("Impersonation API called");

  if (process.env.NODE_ENV !== "development") {
    console.log("Not in development mode, returning 404");
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body: unknown = await req.json();
    console.log("Request body:", body);

    // Type guard for request body
    if (!body || typeof body !== 'object' || !('userId' in body)) {
      console.log("Invalid request body structure");
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { userId } = body as ImpersonateRequest;

    console.log("Extracted userId:", userId);

    if (!userId) {
      console.log("No userId provided");
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    console.log("Setting impersonation cookie for userId:", userId);
    cookieStore.set("next-auth.session-token.impersonated", userId, {
      httpOnly: true,
      secure: false, // Development only
      sameSite: "lax",
    });

    console.log("Impersonation cookie set successfully");
    return NextResponse.json({ success: true, impersonatedUserId: userId });
  } catch (error) {
    console.error("Error in impersonation API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
