// Negative fixture: allowed transaction patterns (CORE-ARCH-011)

declare const db: {
  transaction: (
    fn: (tx: {
      insert: (table: unknown) => {
        values: (vals: unknown) => Promise<unknown>;
      };
    }) => Promise<unknown>
  ) => Promise<unknown>;
};
declare const stripe: {
  transaction: (fn: (t: unknown) => Promise<void>) => Promise<void>;
};
declare const store: {
  transaction: (items: string[], mode: string) => void;
};
declare function getDiscordConfig(): Promise<unknown>;
declare function dispatchNotification(plan: unknown): Promise<void>;
declare function sendEmail(opts: unknown): Promise<void>;
declare const resend: { emails: { send: (opts: unknown) => Promise<void> } };
declare const issues: unknown;

export async function goodPattern(): Promise<unknown> {
  // Pre-transaction fetch of inputs (allowed)
  const _config = await getDiscordConfig();

  // Pure DB operations inside transaction
  const issue = await db.transaction(async (tx) => {
    return await tx.insert(issues).values({});
  });

  // Post-commit external side effects (allowed)
  await dispatchNotification({});
  await sendEmail({ to: "someone@example.test" });
  await resend.emails.send({ to: "someone@example.test" });
  await fetch("https://example.test");

  return issue;
}

export async function unrelatedReceiverGuard(): Promise<void> {
  // Non-db / non-tx receiver guard: stripe.transaction and store.transaction
  await stripe.transaction(async (_t) => {
    await fetch("https://api.stripe.com");
  });
  store.transaction(["items"], "readwrite");
}
