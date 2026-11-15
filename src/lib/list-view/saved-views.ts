import "server-only";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { DbTransaction } from "~/server/db";
import { savedViewDefaults, savedViews } from "~/server/db/schema";
import { err, ok, type Result } from "~/lib/result";
import {
  SAVED_VIEW_NAME_MAX,
  type DefaultViewTarget,
  type ListHost,
  type SavedViewError,
  type StoredSavedView,
} from "~/lib/types";

/**
 * Storage for Saved Views and Default Views (spec list-views.md §10). Every
 * function is scoped to one account and one List Host: a Saved View belongs
 * to a host, never to a Surface (§10.5), and a host's view is never read,
 * changed, or made a default through another host. Each host validates the
 * View Configuration it stores and re-validates what it reads (§10.14).
 */

/** The account's Saved Views for one host, ordered by name. */
export async function listSavedViews(
  tx: DbTransaction,
  userId: string,
  host: ListHost
): Promise<StoredSavedView[]> {
  const t = savedViews;
  return tx
    .select({ id: t.id, name: t.name, state: t.state })
    .from(t)
    .where(and(eq(t.userId, userId), eq(t.host, host)))
    .orderBy(asc(sql`lower(${t.name})`), asc(t.id));
}

/**
 * The account's Default View for one host (§10.9): a Saved View id or a
 * Built-in View id, or null.
 */
export async function getDefaultViewId(
  tx: DbTransaction,
  userId: string,
  host: ListHost
): Promise<string | null> {
  const d = savedViewDefaults;
  const [row] = await tx
    .select({ savedViewId: d.savedViewId, builtInViewId: d.builtInViewId })
    .from(d)
    .where(and(eq(d.userId, userId), eq(d.host, host)))
    .limit(1);
  return row?.savedViewId ?? row?.builtInViewId ?? null;
}

function normalizeName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > SAVED_VIEW_NAME_MAX) {
    return null;
  }
  return trimmed;
}

/** §10.7: unique per account and host, ignoring case. */
async function nameTaken(
  tx: DbTransaction,
  input: {
    userId: string;
    host: ListHost;
    name: string;
    exceptId: string | null;
  }
): Promise<boolean> {
  const t = savedViews;
  const rows = await tx
    .select({ id: t.id })
    .from(t)
    .where(
      and(
        eq(t.userId, input.userId),
        eq(t.host, input.host),
        eq(sql`lower(${t.name})`, input.name.toLowerCase()),
        input.exceptId ? ne(t.id, input.exceptId) : undefined
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Whether `id` is one of the account's own Saved Views of this host. */
async function ownsSavedView(
  tx: DbTransaction,
  input: { userId: string; host: ListHost; id: string }
): Promise<boolean> {
  const t = savedViews;
  const rows = await tx
    .select({ id: t.id })
    .from(t)
    .where(
      and(
        eq(t.id, input.id),
        eq(t.userId, input.userId),
        eq(t.host, input.host)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Save as new (§10.1, §10.7). */
export async function createSavedView(
  tx: DbTransaction,
  input: {
    userId: string;
    host: ListHost;
    name: string;
    state: unknown;
    makeDefault: boolean;
  }
): Promise<Result<{ id: string }, SavedViewError>> {
  const name = normalizeName(input.name);
  if (!name) return err("INVALID_NAME", "Enter a name.");
  if (
    await nameTaken(tx, {
      userId: input.userId,
      host: input.host,
      name,
      exceptId: null,
    })
  ) {
    return err("NAME_TAKEN", "A view with this name already exists");
  }
  const [row] = await tx
    .insert(savedViews)
    .values({
      userId: input.userId,
      host: input.host,
      name,
      state: input.state,
    })
    .returning({ id: savedViews.id });
  if (!row) throw new Error("Saved view insert returned no row");
  if (input.makeDefault) {
    await writeDefault(tx, {
      userId: input.userId,
      host: input.host,
      target: { kind: "saved", id: row.id },
    });
  }
  return ok({ id: row.id });
}

/** Save changes: overwrite a Saved View's configuration. */
export async function updateSavedViewState(
  tx: DbTransaction,
  input: { userId: string; host: ListHost; id: string; state: unknown }
): Promise<Result<{ id: string }, SavedViewError>> {
  const t = savedViews;
  const rows = await tx
    .update(t)
    .set({ state: input.state, updatedAt: new Date() })
    .where(
      and(
        eq(t.id, input.id),
        eq(t.userId, input.userId),
        eq(t.host, input.host)
      )
    )
    .returning({ id: t.id });
  if (rows.length === 0) return err("NOT_FOUND", "View not found.");
  return ok({ id: input.id });
}

/** Rename (§10.7, §10.8). */
export async function renameSavedView(
  tx: DbTransaction,
  input: { userId: string; host: ListHost; id: string; name: string }
): Promise<Result<{ id: string }, SavedViewError>> {
  if (!(await ownsSavedView(tx, input))) {
    return err("NOT_FOUND", "View not found.");
  }
  const name = normalizeName(input.name);
  if (!name) return err("INVALID_NAME", "Enter a name.");
  if (
    await nameTaken(tx, {
      userId: input.userId,
      host: input.host,
      name,
      exceptId: input.id,
    })
  ) {
    return err("NAME_TAKEN", "A view with this name already exists");
  }
  const t = savedViews;
  await tx
    .update(t)
    .set({ name, updatedAt: new Date() })
    .where(
      and(
        eq(t.id, input.id),
        eq(t.userId, input.userId),
        eq(t.host, input.host)
      )
    );
  return ok({ id: input.id });
}

/**
 * Delete (§10.8). Deleting the Default View deletes its default row, leaving
 * the host without one (§10.13); no other view is promoted.
 */
export async function deleteSavedView(
  tx: DbTransaction,
  input: { userId: string; host: ListHost; id: string }
): Promise<Result<{ id: string }, SavedViewError>> {
  const t = savedViews;
  const rows = await tx
    .delete(t)
    .where(
      and(
        eq(t.id, input.id),
        eq(t.userId, input.userId),
        eq(t.host, input.host)
      )
    )
    .returning({ id: t.id });
  if (rows.length === 0) return err("NOT_FOUND", "View not found.");
  return ok({ id: input.id });
}

async function writeDefault(
  tx: DbTransaction,
  input: { userId: string; host: ListHost; target: DefaultViewTarget }
): Promise<void> {
  const d = savedViewDefaults;
  await tx
    .delete(d)
    .where(and(eq(d.userId, input.userId), eq(d.host, input.host)));
  const { target } = input;
  if (target === null) return;
  await tx.insert(d).values({
    userId: input.userId,
    host: input.host,
    savedViewId: target.kind === "saved" ? target.id : null,
    builtInViewId: target.kind === "builtIn" ? target.id : null,
  });
}

/**
 * Sets the account's Default View for a host to one of its Saved Views of
 * that host or one of `builtInViewIds`, or clears it with null (§10.8,
 * §10.9).
 */
export async function setDefaultView(
  tx: DbTransaction,
  input: {
    userId: string;
    host: ListHost;
    target: DefaultViewTarget;
    builtInViewIds: readonly string[];
  }
): Promise<Result<{ id: string | null }, SavedViewError>> {
  const { target } = input;
  if (
    target?.kind === "saved" &&
    !(await ownsSavedView(tx, {
      userId: input.userId,
      host: input.host,
      id: target.id,
    }))
  ) {
    return err("NOT_FOUND", "View not found.");
  }
  if (target?.kind === "builtIn" && !input.builtInViewIds.includes(target.id)) {
    return err("NOT_FOUND", "View not found.");
  }
  await writeDefault(tx, input);
  return ok({ id: target?.id ?? null });
}
