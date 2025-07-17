import { NextRequest, NextResponse } from "next/server";

import { db } from "~/server/db";
import { QRCodeService } from "~/server/services/qrCodeService";
import { constructReportUrl } from "~/server/utils/qrCodeUtils";

export async function GET(
  request: NextRequest,
  { params }: { params: { qrCodeId: string } },
) {
  try {
    const { qrCodeId } = params;

    if (!qrCodeId) {
      return NextResponse.json(
        { error: "QR code ID is required" },
        { status: 400 },
      );
    }

    // Initialize QR code service
    const qrCodeService = new QRCodeService(db);

    // Resolve machine information from QR code
    const machine = await qrCodeService.resolveMachineFromQR(qrCodeId);

    if (!machine) {
      return NextResponse.json({ error: "Invalid QR code" }, { status: 404 });
    }

    // Construct the report issue URL
    const reportUrl = constructReportUrl(machine);

    // Redirect to the machine's report issue page
    return NextResponse.redirect(reportUrl);
  } catch (error) {
    console.error("QR code resolution failed:", error);

    return NextResponse.json(
      {
        error: "Failed to resolve QR code",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Support HEAD requests for health checks
export async function HEAD(
  request: NextRequest,
  { params }: { params: { qrCodeId: string } },
) {
  try {
    const { qrCodeId } = params;

    if (!qrCodeId) {
      return new NextResponse(null, { status: 400 });
    }

    const qrCodeService = new QRCodeService(db);
    const machine = await qrCodeService.resolveMachineFromQR(qrCodeId);

    if (!machine) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("QR code HEAD check failed:", error);
    return new NextResponse(null, { status: 500 });
  }
}
