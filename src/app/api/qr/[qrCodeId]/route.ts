import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveQRCodeToReportUrl, checkQRCodeExists } from "~/lib/dal/qr-codes";
import { withErrorMapping } from "~/server/errors/mapErrorToResponse";
import { BaseAppError, ERROR_TYPES, HTTP_STATUS } from "~/server/errors/errors";
import { withTiming } from "~/server/observability/withTiming";

/**
 * QR Code validation error for structured error handling
 */
class QRCodeValidationError extends BaseAppError {
  constructor(message: string, qrCodeId?: string) {
    super(
      ERROR_TYPES.VALIDATION_ERROR,
      "QR_CODE_INVALID",
      message,
      HTTP_STATUS.BAD_REQUEST,
      { qrCodeId }
    );
  }
}

/**
 * QR Code not found error for structured error handling
 */
class QRCodeNotFoundError extends BaseAppError {
  constructor(qrCodeId: string) {
    super(
      ERROR_TYPES.NOT_FOUND_ERROR,
      "QR_CODE_NOT_FOUND",
      `QR code '${qrCodeId}' not found`,
      HTTP_STATUS.NOT_FOUND,
      { qrCodeId }
    );
  }
}

export const GET = withErrorMapping(async (
  _request: NextRequest,
  { params }: { params: Promise<{ qrCodeId: string }> },
): Promise<NextResponse> => {
  const { qrCodeId } = await params;

  // Validate QR code ID parameter
  if (!qrCodeId || qrCodeId.trim().length === 0) {
    throw new QRCodeValidationError("QR code ID is required");
  }

  // Resolve QR code with timing measurement
  const { result: qrResult } = await withTiming("resolve QR code", async () => {
    return await resolveQRCodeToReportUrl(qrCodeId);
  });

  if (!qrResult.success) {
    switch (qrResult.error) {
      case "not_found":
        throw new QRCodeNotFoundError(qrCodeId);
      case "invalid_id":
        throw new QRCodeValidationError(qrResult.message, qrCodeId);
      default:
        // Let unknown errors be handled by the error mapper as internal errors
        throw new Error(`QR code resolution failed: ${qrResult.message}`);
    }
  }

  // Redirect to the machine's report issue page
  return NextResponse.redirect(qrResult.reportUrl);
});

// Support HEAD requests for health checks
export const HEAD = withErrorMapping(async (
  _request: NextRequest,
  { params }: { params: Promise<{ qrCodeId: string }> },
): Promise<NextResponse> => {
  const { qrCodeId } = await params;

  // Validate QR code ID parameter
  if (!qrCodeId || qrCodeId.trim().length === 0) {
    throw new QRCodeValidationError("QR code ID is required");
  }

  // Check if QR code exists with timing measurement
  const { result: exists } = await withTiming("check QR code exists", async () => {
    return await checkQRCodeExists(qrCodeId);
  });

  if (!exists) {
    throw new QRCodeNotFoundError(qrCodeId);
  }

  return new NextResponse(null, { status: 200 });
});
