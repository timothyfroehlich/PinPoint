# Visibility Inheritance Extended Tests

This file implements the 7 edge cases specified in §6 of the RLS assertions specification for visibility inheritance.

## Test Cases Implemented

1. **Test 1**: Org public + public_issue_default='private' + all NULL chain => issue private
2. **Test 2**: Explicit TRUE under private ancestor inert (org public, location FALSE, issue TRUE => effective private)
3. **Test 3**: Explicit TRUE under private org inert (org private, issue TRUE => private) regression guard
4. **Test 4**: Machine TRUE while location NULL (org public) => machine public; issue inherits TRUE (2 assertions)
5. **Test 5**: Chain precedence: location NULL, machine FALSE, issue TRUE => private (first FALSE wins)
6. **Test 6**: Location TRUE + issue NULL + org default private => issue public (TRUE beats default private, no FALSE)
7. **Test 7**: Mid-txn org privacy flip TRUE->FALSE updates effective visibility (no cascade writes required)

## Running the Tests

```bash
npm run test:rls
```

This will automatically discover and run the new test file along with all other RLS tests.

## Test Structure

- Uses pgTAP framework with plan(8) for 8 total assertions
- Each test description cites "§6 visibility inheritance" as specified
- Uses existing helper functions: `fn_effective_location_public`, `fn_effective_machine_public`, `fn_effective_issue_public`
- Proper transaction handling with BEGIN/ROLLBACK
- If any tests fail during execution, BUG NOTE comments should be added with actual value SELECT statements

## Dependencies

- PostgreSQL database with pgTAP extension
- Supabase local development environment
- Existing RLS policies and helper functions
- Test constants and setup from `../constants.sql`