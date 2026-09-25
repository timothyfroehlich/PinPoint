"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { log } from "~/lib/logger";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import {
  linkPinballMapAccount,
  unlinkPinballMapAccount,
} from "~/lib/pinballmap/user-credentials";
import { checkPinballMapLinkLimit } from "~/lib/rate-limit";
import { type Result, err, ok } from "~/lib/result";
import { createClient } from "~/lib/supabase/server";
import { serverActionError } from "~/lib/observability/report-error";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

/**
 * Link and unlink a member's own Pinball Map account (pinballmap spec 8.4).
 *
 * The password arrives in the form, goes to Pinball Map once, and is dropped.
 * Nothing here logs the form, echoes it back, or stores it.
 */

const linkSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, "Enter your Pinball Map username or email.")
    .max(255, "That username or email is too long."),
  password: z
    .string()
    .min(1, "Enter your Pinball Map password.")
    .max(1024, "That password is too long."),
});

export type LinkPinballMapActionResult = Result<
  { username: string },
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "PBM_UNAVAILABLE"
  | "SERVER"
>;

/** Holders of `machines.pinballmap.account`: members and up, not guests. */
async function authorizeMember(): Promise<
  { ok: true; userId: string } | { ok: false }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (
    !checkPermission(
      "machines.pinballmap.account",
      getAccessLevel(profile?.role)
    )
  )
    return { ok: false };
  return { ok: true, userId: user.id };
}

export async function linkPinballMapAccountAction(
  _prev: LinkPinballMapActionResult | undefined,
  formData: FormData
): Promise<LinkPinballMapActionResult> {
  const authed = await authorizeMember();
  if (!authed.ok)
    return err("UNAUTHORIZED", "Sign in as a member to link Pinball Map.");
  const { userId } = authed;

  const parsed = linkSchema.safeParse({
    login: formData.get("login"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return err(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Check the form and try again."
    );
  }

  const limit = await checkPinballMapLinkLimit(userId);
  if (!limit.success) {
    log.warn(
      { userId, action: "pinballmap.linkRateLimit" },
      "Pinball Map link rate limit exceeded"
    );
    return err(
      "RATE_LIMITED",
      "Too many sign-in attempts. Try again in a few minutes."
    );
  }

  try {
    const result = await linkPinballMapAccount(
      userId,
      parsed.data.login,
      parsed.data.password
    );
    if (!result.ok) {
      switch (result.reason) {
        case "invalid_credentials":
          // Pinball Map's own wording ("Incorrect password", "Unknown user",
          // "User is not yet confirmed…") is the most useful thing to show.
          return err(
            "INVALID_CREDENTIALS",
            result.message ?? "Pinball Map did not accept that sign-in."
          );
        case "account_disabled":
          return err(
            "ACCOUNT_DISABLED",
            "Pinball Map has disabled this account."
          );
        case "rate_limited":
          return err(
            "PBM_UNAVAILABLE",
            "Pinball Map is rate-limiting sign-ins. Try again in a few minutes."
          );
        case "transient":
          return err(
            "PBM_UNAVAILABLE",
            "Pinball Map didn't respond properly. Try again."
          );
        case "server":
          return err("SERVER", "Could not save the link. Try again.");
      }
    }

    revalidatePath("/settings");
    // Push buttons on every machine page depend on the viewer's link (8.2).
    revalidatePath("/m", "layout");
    return ok({ username: result.username });
  } catch (error) {
    return serverActionError(error, "SERVER", "Could not save the link.", {
      userId,
      action: "linkPinballMapAccountAction",
    });
  }
}

export type UnlinkPinballMapActionResult = Result<
  Record<string, never>,
  "UNAUTHORIZED" | "SERVER"
>;

export async function unlinkPinballMapAccountAction(): Promise<UnlinkPinballMapActionResult> {
  const authed = await authorizeMember();
  if (!authed.ok)
    return err("UNAUTHORIZED", "Sign in as a member to unlink Pinball Map.");

  try {
    await unlinkPinballMapAccount(authed.userId);
  } catch (error) {
    return serverActionError(error, "SERVER", "Could not unlink. Try again.", {
      userId: authed.userId,
      action: "unlinkPinballMapAccountAction",
    });
  }
  revalidatePath("/settings");
  revalidatePath("/m", "layout");
  return ok({});
}
