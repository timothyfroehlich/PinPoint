/**
 * Read named string fields from a FormData for a Zod schema to validate. A
 * missing field or a File entry becomes `null`, so the schema owns every
 * validation message.
 */
export function formFields(
  formData: FormData,
  keys: readonly string[]
): Record<string, string | null> {
  return Object.fromEntries(
    keys.map((key) => {
      const value = formData.get(key);
      return [key, typeof value === "string" ? value : null];
    })
  );
}
