// Negative fixture: non-action files and function-level directives

export function Form(): null {
  async function submit(): Promise<void> {
    "use server";
    await Promise.resolve();
  }
  void submit;
  return null;
}

/**
 * Prose mentioning "use server" in comment
 */
export const marker = "use server";

export async function regularHelper(): Promise<void> {
  await Promise.resolve();
}
