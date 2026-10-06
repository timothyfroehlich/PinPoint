import { runSeedSteps } from "./lib/seed-steps.mjs";

// The seed half of `pnpm run db:reset`: every step in supabase/seed-steps.json,
// in order. `db:fast-reset` runs the same list after its TRUNCATE.
try {
  runSeedSteps();
} catch (error) {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
}
