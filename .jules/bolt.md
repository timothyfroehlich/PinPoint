## 2025-02-14 - Database Indexing Patterns

**Learning:** Drizzle ORM does not automatically create indexes for foreign keys defined with `references()`. These must be manually added using the `(t) => ({ ... })` callback in `pgTable`. Explicit indexing on foreign keys (especially for `issue_comments.issue_id`) is critical for performance on detail views.
**Action:** When adding new tables with foreign keys that will be used for filtering or joining, always verify if an index should be explicitly added.

## 2025-12-19 - Dashboard Waterfall & Count Optimization

**Learning:** Independent DB queries in Server Components often default to serial execution (waterfall). Always wrap independent queries in `Promise.all`. Fetching large datasets just to count them (e.g. `array.length`) is an anti-pattern; use `count()` in SQL instead.
**Action:** Audit page loaders for serial `await` calls on independent data and replace array-based counting with SQL aggregation.
