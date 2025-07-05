import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { imageStorage } from "~/lib/image-storage/local-storage";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Upload image
    const imagePath = await imageStorage.uploadImage(
      file,
      `user-${session.user.id}`,
    );

    return NextResponse.json({
      success: true,
      url: imagePath,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 },
    );
  }
}
