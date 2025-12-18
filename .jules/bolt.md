## 2025-02-19 - Parallelizing Independent Drizzle Queries
**Learning:** Dashboard pages often have multiple independent queries (counts, lists) that are mistakenly awaited sequentially.
**Action:** Identify independent query groups and use `Promise.all`. For dependent chains (e.g., fetch user -> fetch their data), wrap them in an async IIFE within the `Promise.all` array to maintain their internal order while running parallel to other queries.
