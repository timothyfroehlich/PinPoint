// Fixture: pinpoint/no-side-effects-in-transaction must fire twice — the bare
// `fetch` call (line 11) and the `sendEmail` helper (line 12), both inside a
// `db.transaction` callback. The post-commit call on line 15 must NOT fire.
declare const db: {
  transaction: (fn: (tx: unknown) => Promise<void>) => Promise<void>;
};
declare function sendEmail(to: string): Promise<void>;

export async function bad(): Promise<void> {
  await db.transaction(async () => {
    await fetch("https://example.test");
    await sendEmail("someone@example.test");
  });

  await sendEmail("someone@example.test");
}
