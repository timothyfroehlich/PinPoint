/**
 * UTF-8 BOM prefix for Excel compatibility.
 * Without this, Excel may misinterpret Unicode characters.
 */
const BOM = "\uFEFF";

/**
 * Neutralize spreadsheet formula injection.
 * Cells starting with =, +, -, or @ can be interpreted as formulas
 * by Excel/Google Sheets. Prefix with a single quote to force text mode.
 */
function sanitizeFormulaInjection(field: string): string {
  if (field.length > 0 && "=+-@".includes(field[0]!)) {
    return `'${field}`;
  }
  return field;
}

/**
 * Escape a single CSV field per RFC 4180:
 * - Neutralize formula injection for spreadsheet safety
 * - If the field contains a comma, double-quote, or newline, wrap it in double quotes
 * - Double any existing double quotes
 */
function escapeField(field: string): string {
  const sanitized = sanitizeFormulaInjection(field);
  if (
    sanitized.includes(",") ||
    sanitized.includes('"') ||
    sanitized.includes("\n") ||
    sanitized.includes("\r")
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * Generate a CSV string from headers and rows.
 * Uses CRLF line endings (RFC 4180) and a UTF-8 BOM for Excel.
 */
export function generateCsv(headers: string[], rows: string[][]): string {
  const headerLine = BOM + headers.map(escapeField).join(",");
  const dataLines = rows.map((row) => row.map(escapeField).join(","));
  return [headerLine, ...dataLines, ""].join("\r\n");
}
