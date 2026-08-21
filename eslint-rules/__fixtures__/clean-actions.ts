// Negative fixture: nothing here may produce a diagnostic.
//   - `clean-actions.ts` matches ACTION_FILENAME_PATTERN, so
//     pinpoint/server-action-file-naming stays quiet on the directive.
//   - the side effect runs after the transaction commits, so
//     pinpoint/no-side-effects-in-transaction stays quiet.
"use server";

declare const db: {
  transaction: (fn: (tx: unknown) => Promise<void>) => Promise<void>;
};
declare function sendEmail(to: string): Promise<void>;

export async function good(): Promise<void> {
  await db.transaction(async () => {
    // Only DB work belongs in here.
  });

  await sendEmail("someone@example.test");
}
