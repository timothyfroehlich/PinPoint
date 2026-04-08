/**
 * UTF-8 BOM prefix for Excel compatibility.
 * Without this, Excel may misinterpret Unicode characters.
 */
const BOM = "\uFEFF";

/**
 * Escape a single CSV field per RFC 4180:
 * - If the field contains a comma, double-quote, or newline, wrap it in double quotes
 * - Double any existing double quotes
 */
function escapeField(field: string): string {
  if (
    field.includes(",") ||
    field.includes('"') ||
    field.includes("\n") ||
    field.includes("\r")
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
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
