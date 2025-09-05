import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveQRCodeToReportUrl, checkQRCodeExists } from "~/lib/dal/qr-codes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ qrCodeId: string }> },
): Promise<NextResponse> {
  try {
    const { qrCodeId } = await params;

    // Validate QR code ID parameter
    if (!qrCodeId || qrCodeId.trim().length === 0) {
      return NextResponse.json(
        { error: "QR code ID is required" },
        { status: 400 }
      );
    }

    // Resolve QR code
    const qrResult = await resolveQRCodeToReportUrl(qrCodeId);

    if (!qrResult.success) {
      switch (qrResult.error) {
        case "not_found":
          return NextResponse.json(
            { error: `QR code '${qrCodeId}' not found` },
            { status: 404 }
          );
        case "invalid_id":
          return NextResponse.json(
            { error: qrResult.message },
            { status: 400 }
          );
        default:
          console.error("QR code resolution failed:", qrResult.message);
          return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
          );
      }
    }

    // Redirect to the machine's report issue page
    return NextResponse.redirect(qrResult.reportUrl);
  } catch (error) {
    console.error("QR code API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Support HEAD requests for health checks
export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ qrCodeId: string }> },
): Promise<NextResponse> {
  try {
    const { qrCodeId } = await params;

    // Validate QR code ID parameter
    if (!qrCodeId || qrCodeId.trim().length === 0) {
      return new NextResponse(null, { status: 400 });
    }

    // Check if QR code exists
    const exists = await checkQRCodeExists(qrCodeId);

    if (!exists) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("QR code HEAD check error:", error);
    return new NextResponse(null, { status: 500 });
  }
}