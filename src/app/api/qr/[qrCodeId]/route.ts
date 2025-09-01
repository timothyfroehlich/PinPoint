import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveQRCodeToReportUrl, checkQRCodeExists } from "~/lib/dal/qr-codes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ qrCodeId: string }> },
): Promise<NextResponse> {
  const { qrCodeId } = await params;

  if (!qrCodeId) {
    return NextResponse.json(
      { error: "QR code ID is required" },
      { status: 400 },
    );
  }

  const result = await resolveQRCodeToReportUrl(qrCodeId);

  if (!result.success) {
    const status = result.error === "not_found" ? 404 : 
                   result.error === "invalid_id" ? 400 : 500;
    
    return NextResponse.json(
      { error: result.message },
      { status }
    );
  }

  // Redirect to the machine's report issue page
  return NextResponse.redirect(result.reportUrl);
}

// Support HEAD requests for health checks
export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ qrCodeId: string }> },
): Promise<NextResponse> {
  const { qrCodeId } = await params;

  if (!qrCodeId) {
    return new NextResponse(null, { status: 400 });
  }

  const exists = await checkQRCodeExists(qrCodeId);

  if (!exists) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, { status: 200 });
}
