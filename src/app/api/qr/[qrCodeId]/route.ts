import { NextRequest, NextResponse } from "next/server";

import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { ServiceFactory } from "~/server/services/factory";
import { constructReportUrl } from "~/server/utils/qrCodeUtils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ qrCodeId: string }> },
): Promise<NextResponse> {
  const dbProvider = getGlobalDatabaseProvider();
  const drizzle = dbProvider.getClient();
  try {
    const { qrCodeId } = await params;

    if (!qrCodeId) {
      return NextResponse.json(
        { error: "QR code ID is required" },
        { status: 400 },
      );
    }

    // Initialize services
    const services = new ServiceFactory(drizzle);
    const qrCodeService = services.createQRCodeService();

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
  } finally {
    await dbProvider.disconnect();
  }
}

// Support HEAD requests for health checks
export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ qrCodeId: string }> },
): Promise<NextResponse> {
  const dbProvider = getGlobalDatabaseProvider();
  const drizzle = dbProvider.getClient();
  try {
    const { qrCodeId } = await params;

    if (!qrCodeId) {
      return new NextResponse(null, { status: 400 });
    }

    const services = new ServiceFactory(drizzle);
    const qrCodeService = services.createQRCodeService();
    const machine = await qrCodeService.resolveMachineFromQR(qrCodeId);

    if (!machine) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("QR code HEAD check failed:", error);
    return new NextResponse(null, { status: 500 });
  } finally {
    await dbProvider.disconnect();
  }
}
