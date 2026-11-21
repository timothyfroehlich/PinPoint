/**
 * Saves a generated CSV through a Blob link. Returns false, having done
 * nothing, when the browser lacks the Blob URL API.
 */
export function downloadCsv(csv: string, fileName: string): boolean {
  if (typeof URL.createObjectURL !== "function") return false;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
