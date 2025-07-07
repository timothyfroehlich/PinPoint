# Add Consistency Field to Issue Database

## Description

Add a `consistency` field to the Issue model to track how often an issue occurs based on data from our existing issue tracking spreadsheet.

## Context

Our existing issue tracking spreadsheet includes a "Consistency" column that tracks the frequency of issues. From the CSV data, we see values like:

- "Always"
- "Every game"
- "Occasionally"

This field helps prioritize issues and understand their severity/impact.

## Acceptance Criteria

- [ ] Add `consistency` field to Issue model in Prisma schema
- [ ] Field should be optional (nullable) for backward compatibility
- [ ] Update issue creation/update forms to include consistency selection
- [ ] Add consistency to issue display/detail views
- [ ] Update tRPC procedures to handle consistency field
- [ ] Add database migration
- [ ] Update seed data to include consistency when available

## Implementation Notes

- Field should be a string type to accommodate various consistency descriptions
- Consider using an enum or predefined values for consistency
- Update both the database schema and TypeScript types
- Ensure multi-tenancy rules still apply

## Data from CSV

From the imported CSV files, consistency values include:

- "Always"
- "Every game"
- "Occasionally"
- Various other frequency descriptions

## Priority

Medium - This field provides valuable context for issue triage but is not blocking core functionality.
