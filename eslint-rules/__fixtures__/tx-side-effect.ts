// Fixture: pinpoint/no-side-effects-in-transaction must fire on all banned
// external side effects inside db.transaction or tx.transaction callbacks.

declare const db: {
  transaction: (
    fn: (tx: {
      transaction: (fn2: (tx2: unknown) => Promise<void>) => Promise<void>;
    }) => Promise<void>
  ) => Promise<void>;
};

declare function sendEmail(to: string): Promise<void>;
declare function sendDm(to: string): Promise<void>;
declare function dispatchNotification(plan: unknown): Promise<void>;
declare function uploadToBlob(data: unknown): Promise<void>;
declare function deleteFromBlob(id: string): Promise<void>;
declare function getDiscordConfig(): Promise<unknown>;
declare const resend: { emails: { send: (opts: unknown) => Promise<void> } };

export async function badArrow(): Promise<void> {
  await db.transaction(async (tx) => {
    await fetch("https://example.test");
    await sendEmail("someone@example.test");
    await sendDm("someone@example.test");
    await dispatchNotification({});
    await uploadToBlob({});
    await deleteFromBlob("123");
    await getDiscordConfig();
    await resend.emails.send({ to: "x" });

    // Nested savepoint
    await tx.transaction(async (_tx2) => {
      await sendEmail("nested@example.test");
    });
  });
}

export async function badFunctionExpression(): Promise<void> {
  await db.transaction(async function (_tx) {
    await sendEmail("someone@example.test");
  });
}
