// Fixture: pinpoint/server-action-file-naming must fire on line 4 — a
// module-level "use server" directive in a file whose basename is neither
// `actions.ts` nor `*-action(s).ts`, and which is not under src/server/actions/.
"use server";

export async function doThing(): Promise<void> {
  return Promise.resolve();
}
