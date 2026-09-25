# Machine View query baseline

Measured 2026-09-22 on Bazzite using PGlite and the branch's real `loadMachineViewFromDatabase` pipeline. Each fixture had 100 or 500 on-floor machines, two open issues and two qualifying service events per machine. The Machines preset displayed its four default fields, and the result was limited to the first 25 rows. Timings are the median of three warm calls; fixture insertion and `EXPLAIN` are excluded.

| Machines | Open issues | Service events | Median loader time |
| -------: | ----------: | -------------: | -----------------: |
|      100 |         200 |            200 |             4.7 ms |
|      500 |       1,000 |          1,000 |            13.0 ms |

The health query's `EXPLAIN` plan at both sizes was `Seq Scan on issues → HashAggregate` grouped by machine initials. The service query's plan was `Seq Scan on timeline_events → Sort → Unique`, ordered by machine ID, event time, sequence, and ID. Both probes used the production scope and status/tag/deletion predicates. The 500-machine plans estimated scan costs of 48.98 for issues and 24.70 for timeline events.

No index is added in this refactor. These fixtures are small enough that PostgreSQL chooses scans, and the full loader remains inexpensive in this PGlite measurement. This is a baseline, not a production latency promise: PGlite runs in process and the fixtures have uniform issue history. Recheck with production-like row counts and `EXPLAIN (ANALYZE, BUFFERS)` on a real PostgreSQL instance before proposing a partial open-issue or latest-service index.
