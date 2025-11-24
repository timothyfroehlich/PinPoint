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
  cookieStore.set(FLASH_COOKIE_KEY, encodeURIComponent(JSON.stringify(flash)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60, // 60 seconds - enough for one redirect
  });
}

/**
 * Read flash message from cookies
 *
 * Call this in Server Components to display flash messages.
 * The message auto-expires after 60 seconds (set when created).
 *
 * Note: Cannot clear cookies in Server Components (Next.js restriction).
 * Flash messages expire automatically via maxAge.
 *
 * @example
 * ```tsx
 * export default function NewIssuePage() {
 *   const flash = await readFlash();
 *   return (
 *     <div>
 *       {flash && <Alert type={flash.type}>{flash.message}</Alert>}
 *       <form>...</form>
 *     </div>
 *   );
 * }
 * ```
 */
export async function readFlash(): Promise<Flash | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_COOKIE_KEY)?.value;

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as Flash;
  } catch {
    return null;
  }
}
