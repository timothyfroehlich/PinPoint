# Worklists: changing many rows found by one filter

Use this for any job like "put every off-the-floor machine on the floor", "link every unlinked machine", or "triage all new issues".

## Before the first change

1. Call the list tool with the filter and `offset: 0`. Note `total`.
2. Show the user the job: the filter, `total`, and what you will change on each row.
3. Work in pages of at most 10 rows. Each page gets its own change preview (SKILL.md §3) and its own "yes".

## Paging while you change rows

When your change removes a row from the filter, the rows after it move up. Asking for `offset: 10` next would skip 10 rows.

1. Always ask for `offset: 0`.
2. Change the rows on that page.
3. Ask for `offset: 0` again. The rows you changed have left the filter, so the page now holds new rows.
4. If you deliberately leave some rows unchanged, they stay in the filter. Set `offset` to the number of rows you have left unchanged so far, so they do not come back.
5. The job is done when a page comes back with `count: 0`. `total` above 0 at that point is the rows you left unchanged.

When your change does **not** remove rows from the filter (for example, adding comments to open issues), page normally: `offset: 0`, then `offset: 10`, and so on.

## Reading back

After each page, call `get_machine` or `get_issue` on every row you changed and confirm the new values. The next page's list call does not count: the rows you changed have left its filter.

## When a row fails

Stop the job. Report which rows were changed, which one failed and its error message word for word. Continue only after the user answers.
