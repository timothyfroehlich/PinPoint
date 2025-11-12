import { cookies } from "next/headers";

/**
 * Flash message type for Post-Redirect-Get pattern
 *
 * Flash messages persist across a single redirect, enabling
 * progressive enhancement - forms work without JavaScript.
 *
 * Used with Server Actions to show success/error messages
 * after form submission and redirect.
 */
export interface Flash {
  type: "success" | "error";
  message: string;
  fields?: Record<string, string>;
}

const FLASH_COOKIE_KEY = "flash";

/**
 * Set a flash message in cookies
 *
 * The message will be available on the next page load,
 * then automatically cleared.
 *
 * @example
 * ```ts
 * export async function createIssue(formData: FormData) {
 *   // ... validation fails
 *   setFlash({
 *     type: "error",
 *     message: "Please fix the highlighted fields.",
 *     fields: { title: formData.get("title") as string }
 *   });
 *   redirect("/issues/new");
 * }
 * ```
 */
export async function setFlash(flash: Flash): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(FLASH_COOKIE_KEY, JSON.stringify(flash), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60, // 60 seconds - enough for one redirect
  });
}

/**
 * Read and clear flash message from cookies
 *
 * Call this in Server Components to display flash messages.
 * The message is automatically deleted after reading.
 *
 * @example
 * ```tsx
 * export default function NewIssuePage() {
 *   const flash = readAndClearFlash();
 *   return (
 *     <div>
 *       {flash && <Alert type={flash.type}>{flash.message}</Alert>}
 *       <form>...</form>
 *     </div>
 *   );
 * }
 * ```
 */
export async function readAndClearFlash(): Promise<Flash | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_COOKIE_KEY)?.value;

  if (!raw) {
    return null;
  }

  // Clear the flash message
  cookieStore.set(FLASH_COOKIE_KEY, "", {
    path: "/",
    maxAge: 0,
  });

  try {
    return JSON.parse(raw) as Flash;
  } catch {
    return null;
  }
}
