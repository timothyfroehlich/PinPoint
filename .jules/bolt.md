## 2025-12-19 - Dashboard Waterfall & Count Optimization

**Learning:** Independent DB queries in Server Components often default to serial execution (waterfall). Always wrap independent queries in `Promise.all`. Fetching large datasets just to count them (e.g. `array.length`) is an anti-pattern; use `count()` in SQL instead.
**Action:** Audit page loaders for serial `await` calls on independent data and replace array-based counting with SQL aggregation.
