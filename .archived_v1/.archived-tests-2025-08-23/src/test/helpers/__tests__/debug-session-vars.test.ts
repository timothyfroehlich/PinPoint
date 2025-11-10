import { expect, test } from "vitest";
import { createTestDatabase } from "../pglite-test-setup";
import { sql } from "drizzle-orm";

test("Debug session variables step by step", async () => {
  const db = await createTestDatabase();

  console.log("=== Testing basic set_config ===");

  // Try basic set_config
  await db.execute(
    sql.raw(`SELECT set_config('app.test_value', 'hello', false)`),
  );

  // Try to read it back
  const result1 = await db.execute(
    sql`SELECT current_setting('app.test_value', true) as value`,
  );
  console.log("set_config result:", result1);

  console.log("=== Testing sql.raw SET ===");

  // Try direct SET with sql.raw
  await db.execute(sql.raw(`SET app.test_value2 = 'world'`));

  // Try to read it back
  const result2 = await db.execute(
    sql`SELECT current_setting('app.test_value2', true) as value`,
  );
  console.log("sql.raw SET result:", result2);

  console.log("=== Test completed ===");

  // Just pass the test to see console output
  expect(true).toBe(true);
});
