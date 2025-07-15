import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/server/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { qrCodeId: string } },
) {
  try {
    const { qrCodeId } = params;

    const machine = await db.machine.findUnique({
      where: { qrCodeId },
      include: {
        model: true,
        location: true,
        organization: true,
      },
    });

    if (!machine) {
      return NextResponse.json({ error: "QR code not found" }, { status: 404 });
    }

    // Redirect to the machine's report issue page
    const reportUrl = `https://${machine.organization.subdomain}.pinpoint.app/machines/${machine.id}/report-issue`;

    return NextResponse.redirect(reportUrl);
  } catch (error) {
    console.error("QR code resolution error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
